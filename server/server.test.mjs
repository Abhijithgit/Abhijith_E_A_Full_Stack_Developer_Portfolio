import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createPortfolioServer } from './index.mjs';
import { createOwner,changePassword,OWNER_ID } from './auth.mjs';
const defaults=JSON.parse(await readFile(new URL('../public/portfolio.json',import.meta.url),'utf8'));
async function launch(directory,options={}){const server=await createPortfolioServer({dataDirectory:directory,defaults,...options});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;return {server,origin};}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
test('Only the owner can change the portfolio; saved data persists and sessions revoke',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'portfolio-owner-test-'));const password=randomBytes(24).toString('base64url');await createOwner(directory,OWNER_ID,password);
 const record=await readFile(path.join(directory,'owner.json'),'utf8');assert.ok(!record.includes(password));assert.ok(JSON.parse(record).hash);
 await assert.rejects(()=>createOwner(directory,OWNER_ID,password));
 let {server,origin}=await launch(directory);
 const api=async(route,method='GET',data,headers={})=>fetch(origin+'/api/'+route,{method,headers:{...(method==='GET'?{}:{Origin:origin,'Content-Type':'application/json'}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
 try{
  let response=await api('portfolio');assert.equal(response.status,200);let initial=await response.json();assert.equal(initial.revision,1);
  assert.equal((await api('portfolio','PUT',{content:defaults,revision:1})).status,401);
  assert.equal((await api('portfolio','PUT',{content:defaults,revision:1},{Cookie:'portfolio_session=fake'})).status,401);
  assert.equal((await api('auth/login','POST',{userId:OWNER_ID,password},{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await api('auth/register','POST',{})).status,404);
  assert.equal((await api('auth/login','POST',{userId:OWNER_ID,password:'incorrect-password'})).status,401);
  assert.equal((await api('auth/login','POST',{userId:'not-the-owner',password})).status,401);
  response=await api('auth/login','POST',{userId:OWNER_ID,password});assert.equal(response.status,200);let session=await response.json();const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);const auth={Cookie:cookie.split(';')[0],'X-CSRF-Token':session.csrfToken};
  assert.equal((await(await api('auth/session','GET',undefined,auth)).json()).authenticated,true);
  assert.equal((await api('portfolio','PUT',{content:defaults,revision:1},{Cookie:auth.Cookie})).status,403);
  assert.equal((await api('portfolio','PUT',{content:defaults,revision:1},{...auth,Origin:'https://untrusted.example'})).status,403);
  const changed=structuredClone(defaults);changed.profile.role='Updated by authenticated owner';response=await api('portfolio','PUT',{content:changed,revision:1},auth);assert.equal(response.status,200);assert.equal((await response.json()).revision,2);
  assert.equal((await(await api('portfolio')).json()).content.profile.role,'Updated by authenticated owner');
  assert.equal(JSON.parse(await readFile(path.join(directory,'portfolio.json'),'utf8')).content.profile.role,'Updated by authenticated owner');
  assert.equal((await api('portfolio','PUT',{content:defaults,revision:1},auth)).status,409);
  assert.equal((await api('portfolio','PUT',{content:{},revision:2},auth)).status,400);
  assert.equal((await fetch(origin+'/.data/owner.json')).status,404);
  assert.equal((await api('auth/logout','POST',{},auth)).status,200);
  assert.equal((await api('portfolio','PUT',{content:defaults,revision:2},auth)).status,401);
  response=await api('auth/login','POST',{userId:OWNER_ID,password});session=await response.json();const nextAuth={Cookie:response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':session.csrfToken};
  const nextPassword=randomBytes(24).toString('base64url');await changePassword(directory,password,nextPassword);
  assert.equal((await api('portfolio','PUT',{content:defaults,revision:2},nextAuth)).status,401);
  for(let i=0;i<5;i++)assert.equal((await api('auth/login','POST',{userId:OWNER_ID,password:'wrong'})).status,401);
  assert.equal((await api('auth/login','POST',{userId:OWNER_ID,password:nextPassword})).status,429);
 }finally{await close(server);}
 ({server,origin}=await launch(directory));try{const saved=await(await fetch(origin+'/api/portfolio')).json();assert.equal(saved.revision,2);assert.equal(saved.content.profile.role,'Updated by authenticated owner');assert.equal((await(await fetch(origin+'/api/auth/session')).json()).authenticated,false);}finally{await close(server);}
});
test('Unconfigured owner fails closed and production requires HTTPS configuration',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'portfolio-unconfigured-'));const {server,origin}=await launch(directory);
 try{const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({userId:OWNER_ID,password:'anything'})});assert.equal(response.status,503);}finally{await close(server);}
 await assert.rejects(()=>createPortfolioServer({dataDirectory:directory,defaults,production:true}),/HTTPS/);
});
test('Sessions expire and production cookies require secure transport',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'portfolio-expiry-'));const password=randomBytes(24).toString('base64url');await createOwner(directory,OWNER_ID,password);
 const {server,origin}=await launch(directory,{production:true,origin:'https://portfolio.example',sessionDuration:25});
 try{
  const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:'https://portfolio.example','Content-Type':'application/json'},body:JSON.stringify({userId:OWNER_ID,password})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie');assert.match(cookie,/^__Host-portfolio_session=/);assert.match(cookie,/; Secure/);
  await new Promise(resolve=>setTimeout(resolve,50));
  const result=await fetch(origin+'/api/auth/session',{headers:{Cookie:cookie.split(';')[0]}});assert.equal((await result.json()).authenticated,false);
 }finally{await close(server);}
});
