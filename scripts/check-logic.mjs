import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=name=>readFileSync(new URL('src/'+name,root),'utf8').replace(/^\uFEFF/,'');
const original=JSON.parse(readFileSync(new URL('public/portfolio.json',root),'utf8'));
let storage=new Map(),quota=false,download=null;
const sandbox={CONTENT:original,structuredClone,console,AbortController,Error,DOMException,Blob,encodeURIComponent,Date,Number,Set,confirm:()=>true,setTimeout:()=>0,clearTimeout(){},URL:{createObjectURL(blob){download=blob;return 'blob:backup';},revokeObjectURL(){}},document:{title:'',createElement(){return {click(){},href:'',download:''};}},localStorage:{getItem:k=>storage.get(k)??null,setItem(k,v){if(quota)throw new DOMException('Full','QuotaExceededError');storage.set(k,v);},removeItem:k=>storage.delete(k)},inject:()=>structuredClone(original),signal(initial){let value=initial;const f=()=>value;f.set=x=>value=x;return f;},computed:fn=>fn,viewChild:()=>()=>({nativeElement:{showModal(){},close(){}}}),EventEmitter:class{last;emit(v){this.last=v;}}};
vm.createContext(sandbox);
function run(code){vm.runInContext(stripTypeScriptTypes(code,{mode:'strip'}),sandbox);}
let data=source('data.ts').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
run(data+'\nglobalThis.check=checkedData;');
assert.equal(sandbox.check(original).profile.name,'Abhijith E A');
for(const mutate of [d=>delete d.profile,d=>d.profile.email='bad',d=>d.appearance.accent='red',d=>d.projects.push(d.projects[0]),d=>d.projects[0].category='other']){
 const invalid=structuredClone(original);mutate(invalid);assert.throws(()=>sandbox.check(invalid));
}
const empty=structuredClone(original);empty.projects=[];assert.equal(sandbox.check(empty).projects.length,0);
let editor=source('editor.ts');editor=editor.slice(editor.indexOf('export class PortfolioFieldsComponent')).replace('export class','class').replace(/@(Input|Output)\(\)/g,'');
run(editor+'\nglobalThis.Fields=PortfolioFieldsComponent;');
const fields=new sandbox.Fields();fields.field='projects';fields.value=[];fields.add();
const project=fields.valueChange.last[0];assert.equal(project.name,'New project');assert.equal(project.category,'Personal');assert.equal(project.image,'');
const modified=structuredClone(original);modified.projects.push(project);assert.equal(sandbox.check(modified).projects.length,5);
fields.value=['a','b'];fields.move(0,1);assert.equal(JSON.stringify(fields.valueChange.last),'["b","a"]');assert.equal(JSON.stringify(fields.value),'["a","b"]');fields.remove(0);assert.equal(JSON.stringify(fields.valueChange.last),'["b"]');
fields.valueChange.last=null;fields.upload({target:{files:[{type:'image/svg+xml',size:200}],value:'test'}});assert.match(fields.uploadMessage,/under 1.5 MB/);assert.equal(fields.valueChange.last,null);
fields.upload({target:{files:[{type:'image/gif',size:2_000_000}],value:'test'}});assert.equal(fields.valueChange.last,null);
sandbox.FileReader=class{readAsDataURL(){this.result='data:image/gif;base64,R0lGODlh';this.onload();}};
fields.upload({target:{files:[{type:'image/gif',size:1000}],value:'test'}});assert.equal(fields.valueChange.last,'data:image/gif;base64,R0lGODlh');
let reduced=false,disabled=false;const events={},styles={};
sandbox.matchMedia=q=>({matches:q.includes('reduce')?reduced:true});sandbox.requestAnimationFrame=fn=>{fn();return 1;};sandbox.cancelAnimationFrame=()=>{};
let motion=source('motion.ts');motion=motion.slice(motion.indexOf('export class MotionSurfaceDirective')).replace('export class','class');run(motion+'\nglobalThis.Motion=MotionSurfaceDirective;');
const element={addEventListener:(name,fn)=>events[name]=fn,getBoundingClientRect:()=>({left:0,top:0,width:200,height:200}),style:{setProperty:(k,v)=>styles[k]=v},closest:()=>disabled?{}:null};
const effect=new sandbox.Motion({nativeElement:element},{runOutsideAngular:fn=>fn()});
events.pointermove({pointerType:'mouse',clientX:200,clientY:0});assert.equal(styles['--ry'],'2.5deg');assert.equal(styles['--rx'],'2.5deg');events.pointerleave();assert.equal(styles['--glow'],'0');
reduced=true;events.pointermove({pointerType:'mouse',clientX:200,clientY:0});assert.equal(styles['--glow'],'0');reduced=false;disabled=true;events.pointermove({pointerType:'mouse',clientX:200,clientY:0});assert.equal(styles['--glow'],'0');disabled=false;events.pointermove({pointerType:'touch',clientX:200,clientY:0});assert.equal(styles['--glow'],'0');effect.ngOnDestroy();
console.log('PASS: data validation, add/remove/reorder, GIF upload limits and reduced-motion behaviour. Server access-control tests cover authentication and persistence.');
console.log('These checks execute source logic with Angular services mocked; they do not replace an Angular production build or compiled-app browser tests.');
