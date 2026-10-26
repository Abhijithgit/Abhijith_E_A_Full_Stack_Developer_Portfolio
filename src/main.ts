import { Component, ElementRef, signal, viewChild, computed, inject, InjectionToken } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';
import { CONTENT } from './content';
import { PortfolioFieldsComponent } from './editor';
import { MotionSurfaceDirective } from './motion';
import { checkedData } from './data';
import type { PortfolioData } from './data';
type Project = PortfolioData['projects'][number];
interface InitialState {content:PortfolioData;revision:number;apiAvailable:boolean;}
const INITIAL_CONTENT = new InjectionToken<InitialState>('portfolio-content');
@Component({selector:'app-root', standalone:true,imports:[FormsModule,PortfolioFieldsComponent,MotionSurfaceDirective],templateUrl:'./app.html'})
class AppComponent {
 private readonly original = inject(INITIAL_CONTENT);
 private readonly state = signal<PortfolioData>(structuredClone(this.original.content));
 private revision=this.original.revision;
 private csrfToken='';
 readonly isOwner=signal(false);
 readonly loginBusy=signal(false);
 readonly saveBusy=signal(false);
 readonly loginMessage=signal('');
 loginUserId='Abhijithea';
 loginPassword='';
 readonly loginDialog=viewChild<ElementRef<HTMLDialogElement>>('loginDialog');
 get content():PortfolioData {return this.state();}
 readonly filters = ['All work', 'Professional', 'Personal'] as const;
 readonly filter = signal<string>('All work');
 readonly menuOpen = signal(false);
 readonly activeProject = signal<Project | null>(null);
 readonly copyMessage = signal('Copy email');
 readonly message = signal('');
 readonly editorMessage = signal('');
 readonly editorSection = signal<keyof PortfolioData>('profile');
 readonly editorSections: {key:keyof PortfolioData;label:string}[] = [{key:'profile',label:'My details'},{key:'projects',label:'Projects'},{key:'experience',label:'Experience'},{key:'skills',label:'Skills'},{key:'about',label:'About me'},{key:'summary',label:'Full summary'},{key:'education',label:'Education'},{key:'certifications',label:'Certifications'},{key:'languages',label:'Languages'},{key:'site',label:'Page text'},{key:'appearance',label:'Colour & motion'}];
 draft:PortfolioData = structuredClone(this.content);
 readonly projects = computed(() => this.content.projects.filter(p => this.filter() === 'All work' || p.category === this.filter()));
 readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('projectDialog');
 readonly editor = viewChild<ElementRef<HTMLDialogElement>>('editorDialog');
 constructor(){document.title=`${this.content.profile.name} | ${this.content.profile.role}`;void this.refreshSession();}
 private async request(endpoint:string,options:RequestInit={}) {
  const response=await fetch('/api/'+endpoint,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...options.headers}});
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error||'The request could not be completed.') as Error & {status:number};error.status=response.status;throw error;}
  return result;
 }
 private async refreshSession(){
  if(!this.original.apiAvailable)return;
  try {const session=await this.request('auth/session');this.isOwner.set(session.authenticated===true);this.csrfToken=session.authenticated?session.csrfToken:'';}catch{this.isOwner.set(false);}
 }
 openLogin(){this.loginPassword='';this.loginMessage.set(this.original.apiAvailable?'':'Secure login requires the portfolio server. Build the app and run npm run serve.');this.loginDialog()?.nativeElement.showModal();}
 closeLogin(){this.loginPassword='';this.loginDialog()?.nativeElement.close();}
 async login(){
  if(this.loginBusy()||!this.original.apiAvailable)return;this.loginBusy.set(true);this.loginMessage.set('');
  try {const session=await this.request('auth/login',{method:'POST',body:JSON.stringify({userId:this.loginUserId,password:this.loginPassword})});this.csrfToken=session.csrfToken;this.isOwner.set(session.authenticated===true);this.closeLogin();this.message.set('Signed in as portfolio owner. You can now edit and save your portfolio.');}
  catch(error){this.loginPassword='';this.loginMessage.set(error instanceof Error?error.message:'Could not sign in.');}finally{this.loginBusy.set(false);}
 }
 async logout(){
  try{await this.request('auth/logout',{method:'POST',headers:{'X-CSRF-Token':this.csrfToken},body:'{}'});this.closeEditor();this.isOwner.set(false);this.csrfToken='';this.draft=structuredClone(this.content);this.message.set('Signed out. The portfolio is in view-only mode.');}
  catch{this.message.set('Sign-out could not be confirmed. Please try again.');}
 }
 openProject(project: Project) { this.activeProject.set(project); this.dialog()?.nativeElement.showModal(); }
 closeProject() { this.dialog()?.nativeElement.close(); }
 closeMenu() { this.menuOpen.set(false); }
 closeBackdrop(event: MouseEvent) { if (event.target === this.dialog()?.nativeElement) this.closeProject(); }
 safeImage(value:string):string {return /^(https:\/\/|data:image\/(png|jpeg|gif|webp);base64,)/i.test(value) || /^[\w./-]+$/.test(value) ? value : '';}
 safeLink(value:string):string {return /^(https?:\/\/)/i.test(value) || (/^[\w./-]+$/.test(value) && !value.startsWith('//')) ? value : '';}
 isGif(value:string):boolean {return /^data:image\/gif;/i.test(value) || /\.gif(?:[?#]|$)/i.test(value);}
 emailHref():string {return 'mailto:'+encodeURIComponent(this.content.profile.email);}
 phoneHref():string {return 'tel:'+this.content.profile.phone.replace(/[^+\d]/g,'');}
 async copyEmail() {
  try { await navigator.clipboard.writeText(this.content.profile.email); this.copyMessage.set('Email copied'); }
  catch { this.copyMessage.set('Email: '+this.content.profile.email); }
  setTimeout(() => this.copyMessage.set('Copy email'), 5000);
 }
 openEditor() {if(!this.isOwner()){this.openLogin();return;}this.draft=structuredClone(this.content);this.editorMessage.set('');this.editor()?.nativeElement.showModal();}
 closeEditor() {this.editor()?.nativeElement.close();}
 setDraft(value:unknown){if(!this.isOwner())return;this.draft={...this.draft,[this.editorSection()]:value};}
 async saveEdits() {
  if(!this.isOwner()||this.saveBusy())return;this.saveBusy.set(true);
  try {const data=checkedData(this.draft);const result=await this.request('portfolio',{method:'PUT',headers:{'X-CSRF-Token':this.csrfToken},body:JSON.stringify({content:data,revision:this.revision})});const saved=checkedData(result.content);this.revision=result.revision;this.state.set(saved);this.filter.set('All work');document.title=`${saved.profile.name} | ${saved.profile.role}`;this.closeEditor();this.message.set('Portfolio saved. Your updated details are now available to visitors.');}
  catch(error){this.editorMessage.set(error instanceof Error?error.message:'Could not save.');if((error as {status?:number}).status===401){this.closeEditor();this.isOwner.set(false);this.csrfToken='';this.message.set('Your owner session expired. Please sign in again before editing.');}}
  finally{this.saveBusy.set(false);}
 }
 downloadChanges() {
  if(!this.isOwner())return;
  try {const data=checkedData(this.draft);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='portfolio.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.editorMessage.set('Backup downloaded. Save changes publishes your edited details through the protected server.');}
  catch(error){this.editorMessage.set(error instanceof Error ? error.message : 'Could not export these details.');}
 }
 async importChanges(event:Event) {
  if(!this.isOwner())return;
  const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;
  try {if(file.size>8_000_000)throw new Error('Choose a portfolio.json file under 8 MB.');this.draft=checkedData(JSON.parse(await file.text()));this.editorMessage.set('Backup loaded into the editor. Review it, then select Save changes to apply.');}
  catch(error){this.editorMessage.set(error instanceof Error ? error.message : 'Could not import this file.');}finally{input.value='';}
 }
 restoreOriginal() {
  if(!this.isOwner())return;
  if(!confirm('Discard unsaved edits and return to the last saved portfolio?'))return;
  this.draft=structuredClone(this.content);this.editorMessage.set('Unsaved changes discarded.');
 }

}
async function start(){
 let content:PortfolioData=structuredClone(CONTENT);let revision=1;let apiAvailable=false;
 try {const response=await fetch('/api/portfolio',{signal:AbortSignal.timeout(3000)});if(response.ok){const result=await response.json();content=checkedData(result.content);revision=result.revision;apiAvailable=true;}}catch{}
 if(!apiAvailable){try{const response=await fetch(new URL('portfolio.json',document.baseURI),{signal:AbortSignal.timeout(3000)});if(response.ok)content=checkedData(await response.json());}catch{}}
 await bootstrapApplication(AppComponent,{providers:[{provide:INITIAL_CONTENT,useValue:{content,revision,apiAvailable}}]});
}
start().catch(error => console.error(error));
