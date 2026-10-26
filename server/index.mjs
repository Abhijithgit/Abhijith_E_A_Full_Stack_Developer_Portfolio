import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile,writeFile,rename,mkdir,stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readOwner,verifyPassword,digest } from './auth.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.pdf':'application/pdf','.ico':'image/x-icon','.woff2':'font/woff2'};
function validate(value,shape,label='Portfolio'){
 if(Array.isArray(shape)){if(!Array.isArray(value)||value.length>100)throw new Error(label+': invalid list.');for(const item of value)validate(item,shape[0],label);}
 else if(shape&&typeof shape==='object'){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(label+': invalid section.');for(const [key,item]of Object.entries(shape))validate(value[key],item,label+'/'+key);}
 else if(typeof value!==typeof shape||(typeof value==='string'&&value.length>2100000))throw new Error(label+': invalid field.');
}
export async function createPortfolioServer(options={}){
 const directory=path.resolve(options.dataDirectory||process.env.PORTFOLIO_DATA_DIR||path.join(root,'.data'));
 const staticDirectory=path.resolve(options.staticDirectory||path.join(root,'dist'));
 const defaults=options.defaults||JSON.parse(await readFile(path.join(root,'public/portfolio.json'),'utf8'));
 const production=options.production??process.env.NODE_ENV==='production';
 const configuredOrigin=options.origin||process.env.PUBLIC_ORIGIN;
 if(production&&(!configuredOrigin||!configuredOrigin.startsWith('https://')))throw new Error('Production requires PUBLIC_ORIGIN=https://your-domain. Put this Node server behind HTTPS.');
 const sessions=new Map(),attempts=new Map();const maxAge=options.sessionDuration??60*60*1000;
 const cookieName=production?'__Host-portfolio_session':'portfolio_session';
 let state={content:structuredClone(defaults),revision:1};
 try{state=JSON.parse(await readFile(path.join(directory,'portfolio.json'),'utf8'));validate(state.content,defaults);if(!Number.isSafeInteger(state.revision)||state.revision<1)throw new Error('Invalid saved portfolio revision.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const persisted=path.join(directory,'portfolio.json');
 function originFor(){return configuredOrigin||'http://127.0.0.1:'+server.address().port;}
 function headers(response){
  response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','same-origin');response.setHeader('X-Frame-Options','DENY');response.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if(production)response.setHeader('Strict-Transport-Security','max-age=31536000');
 }
 function json(response,status,body,extra={}){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});response.end(JSON.stringify(body));}
 function cookie(request){const part=(request.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));return part?.slice(cookieName.length+1);}
 function setCookie(response,token,expiry=false){response.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${expiry?0:Math.floor(maxAge/1000)}${production?'; Secure':''}`);}
 async function authenticate(request){
  const token=cookie(request);if(!token||token.length>128)return null;const key=digest(token);const session=sessions.get(key);if(!session)return null;
  const owner=await readOwner(directory);if(session.expires<=Date.now()||!owner||owner.version!==session.version){sessions.delete(key);return null;}return session;
 }
 async function body(request,limit=8_000_000){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type']||''))throw Object.assign(new Error('Send JSON content.'),{status:415});
  let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>limit)throw Object.assign(new Error('Request is too large.'),{status:413});chunks.push(chunk);}try{const parsed=JSON.parse(Buffer.concat(chunks).toString());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed;}catch{throw Object.assign(new Error('Invalid JSON object.'),{status:400});}
 }
 let saving=false;
 const server=createServer(async(request,response)=>{
  headers(response);
  try{
   const pathname=new URL(request.url,'http://localhost').pathname;
   if(pathname.startsWith('/api/')){
    if(['POST','PUT','PATCH','DELETE'].includes(request.method)&&request.headers.origin!==originFor())return json(response,403,{error:'This action must come from this website.'});
    if(pathname==='/api/portfolio'&&request.method==='GET')return json(response,200,state);
    if(pathname==='/api/auth/session'&&request.method==='GET'){const session=await authenticate(request);return json(response,200,session?{authenticated:true,userId:session.userId,csrfToken:session.csrf}:{authenticated:false});}
    if(pathname==='/api/auth/login'&&request.method==='POST'){
     const ip=request.socket.remoteAddress||'unknown';const now=Date.now();for(const [key,entry]of attempts)if(now-entry.start>15*60*1000)attempts.delete(key);
     let entry=attempts.get(ip);if(entry&&entry.count>=5)return json(response,429,{error:'Too many login attempts. Please try again later.'},{'Retry-After':'900'});
     const input=await body(request,4096);const owner=await readOwner(directory);if(!owner)return json(response,503,{error:'Owner login has not been configured. Run the owner setup on the server.'});
     if(!entry){entry={count:0,start:now};attempts.set(ip,entry);}entry.count++;
     const userId=typeof input.userId==='string'?input.userId.trim():'';const password=typeof input.password==='string'?input.password:'';
     if(userId.length>100||!await verifyPassword(owner,userId,password))return json(response,401,{error:'Incorrect user ID or password.'});
     attempts.delete(ip);for(const [key,session]of sessions)if(session.expires<Date.now())sessions.delete(key);if(sessions.size>=100)sessions.delete(sessions.keys().next().value);
     const previous=cookie(request);if(previous)sessions.delete(digest(previous));const token=randomBytes(32).toString('base64url');const session={userId:owner.userId,csrf:randomBytes(32).toString('base64url'),expires:Date.now()+maxAge,version:owner.version};sessions.set(digest(token),session);setCookie(response,token);return json(response,200,{authenticated:true,userId:owner.userId,csrfToken:session.csrf});
    }
    if((pathname==='/api/portfolio'&&request.method==='PUT')||(pathname==='/api/auth/logout'&&request.method==='POST')){
     const session=await authenticate(request);if(!session)return json(response,401,{error:'Please sign in as the portfolio owner.'});
     if(request.headers['x-csrf-token']!==session.csrf)return json(response,403,{error:'Your session could not be verified. Sign in again.'});
     if(pathname==='/api/auth/logout'){sessions.delete(digest(cookie(request)));setCookie(response,'',true);return json(response,200,{authenticated:false});}
     const input=await body(request);if(input.revision!==state.revision||saving)return json(response,409,{error:'The portfolio changed in another tab. Reload before saving.'});
     validate(input.content,defaults);const content=input.content;
     if(!content.profile.name.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.profile.email)||!/^#[0-9a-f]{6}$/i.test(content.appearance.accent))return json(response,400,{error:'Check the name, email and accent colour.'});
     const ids=new Set();for(const project of content.projects){if(!Number.isFinite(project.id)||ids.has(project.id)||!project.name.trim()||!['Professional','Personal'].includes(project.category))return json(response,400,{error:'Check project names, categories and unique IDs.'});ids.add(project.id);}
     saving=true;
     try{const next={content:structuredClone(content),revision:state.revision+1};await mkdir(directory,{recursive:true,mode:0o700});const temp=path.join(directory,'portfolio.'+randomBytes(8).toString('hex')+'.tmp');await writeFile(temp,JSON.stringify(next),{mode:0o600});await rename(temp,persisted);state=next;return json(response,200,state);}finally{saving=false;}
    }
    return json(response,404,{error:'Not found.'});
   }
   if(!['GET','HEAD'].includes(request.method))return json(response,405,{error:'Method not allowed.'});
   if(pathname==='/portfolio.json')return json(response,200,state.content);
   let decoded;try{decoded=decodeURIComponent(pathname);}catch{return json(response,400,{error:'Invalid path.'});}
   let filename=path.resolve(staticDirectory,'.'+decoded);const relative=path.relative(staticDirectory,filename);
   if(relative.startsWith('..')||path.isAbsolute(relative)||decoded.split('/').some(part=>part.startsWith('.')))return json(response,404,{error:'Not found.'});
   let info;try{info=await stat(filename);}catch{}
   if(!info?.isFile())filename=path.join(staticDirectory,'index.html');
   let bytes;try{bytes=await readFile(filename);}catch{return json(response,503,{error:'Build the Angular app first with npm run build.'});}
   response.writeHead(200,{'Content-Type':MIME[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache'});response.end(request.method==='HEAD'?undefined:bytes);
  }catch(error){const status=error.status||(error.message?.startsWith('Portfolio')?400:500);json(response,status,{error:status===500?'The server could not complete this action.':error.message});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=60;
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=await createPortfolioServer();const port=Number(process.env.PORT||4300);const host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`Portfolio server: http://${host}:${port}. Owner login is available after owner setup.`));
}
