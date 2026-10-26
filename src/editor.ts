import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
@Component({selector:'portfolio-fields',standalone:true,imports:[FormsModule],template:`
 @if (isArray(value)) {
  <div class="editor-array"><button class="editor-add" type="button" (click)="add()">+ Add {{ label(field) }}</button>@for (item of value; track $index; let index = $index) {
   <div class="editor-item"><div class="editor-item-head"><strong>{{ itemTitle(item,index) }}</strong><div><button type="button" (click)="move(index,-1)" [disabled]="index === 0" aria-label="Move item up">↑</button><button type="button" (click)="move(index,1)" [disabled]="index === value.length-1" aria-label="Move item down">↓</button><button type="button" (click)="remove(index)" aria-label="Remove item">Remove</button></div></div>
   <portfolio-fields [value]="item" [field]="field" [path]="path + '-' + index" (valueChange)="replace(index,$event)" />
   </div>
  }</div>
 } @else if (isObject(value)) {
  <div class="editor-fields">@for (entry of entries(); track entry.key) {
   @if (entry.key !== 'id') {<div class="editor-field"><label [for]="path + '-' + entry.key">{{ label(entry.key) }}</label><portfolio-fields [value]="entry.value" [field]="entry.key" [path]="path + '-' + entry.key" (valueChange)="set(entry.key,$event)" /></div>}
  }</div>
 } @else if (isBoolean(value)) {
  <label class="editor-check"><input type="checkbox" [id]="path" [ngModel]="value" (ngModelChange)="valueChange.emit($event)"> Enabled</label>
 } @else if (field === 'category') {
  <select [id]="path" [ngModel]="value" (ngModelChange)="valueChange.emit($event)"><option>Professional</option><option>Personal</option></select>
 } @else if (field === 'visual') {
  <select [id]="path" [ngModel]="value" (ngModelChange)="valueChange.emit($event)"><option value="asset">Orbit illustration</option><option value="loan">Workflow illustration</option><option value="cart">Shopping illustration</option><option value="stream">Play illustration</option></select>
 } @else if (field === 'accent') {
  <div class="color-picker"><input type="color" [id]="path" [ngModel]="value" (ngModelChange)="valueChange.emit($event)"><span>{{ value }}</span></div>
 } @else {
  <textarea [id]="path" [rows]="longField() ? 4 : 2" [ngModel]="value" (ngModelChange)="valueChange.emit($event)" [attr.aria-label]="label(field)" spellcheck="true"></textarea>
  @if (isMedia()) {<div class="media-upload"><label class="upload-label">Upload image or GIF<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" (change)="upload($event)"></label>@if (value) {<button type="button" (click)="valueChange.emit('')">Clear image</button><img [src]="safeImage(value)" alt="Selected media preview">}<small>{{ uploadMessage || 'PNG, JPG, WebP or animated GIF. Maximum 1.5 MB. You can also enter an HTTPS image URL above.' }}</small></div>}
  @if (field === 'cvUrl') {<small>Place your updated PDF in public/ and enter its filename, or use an HTTPS URL.</small>}
 }
`})
export class PortfolioFieldsComponent {
 @Input() value: any;
 @Input() field = '';
 @Input() path = 'field';
 @Output() valueChange = new EventEmitter<any>();
 uploadMessage = '';
 isArray = Array.isArray;
 isObject(value: any): boolean { return value !== null && typeof value === 'object' && !Array.isArray(value); }
 isBoolean(value: any): boolean { return typeof value === 'boolean'; }
 entries(): {key:string;value:any}[] { return Object.entries(this.value || {}).map(([key,value])=>({key,value})); }
 label(key: string): string { const labels:Record<string,string>={projects:'project',experience:'role',skills:'skill group',certifications:'certification',paragraphs:'paragraph',items:'skill',bullets:'contribution',tags:'technology',languages:'language',stack:'technology',cvUrl:'CV download URL or filename',demoUrl:'Live project URL',sourceUrl:'Source code URL',gif:'Animated illustration',motion:'Mouse motion and hover effects',showGif:'Show animated illustration',image:'Project image or GIF',visual:'Fallback illustration',github:'GitHub URL'};return labels[key] || key.replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase()); }
 itemTitle(item:any,index:number):string { return String(item?.name || item?.role || item?.label || `${this.label(this.field)} ${index+1}`); }
 set(key:string,value:any) { this.valueChange.emit({...this.value,[key]:value}); }
 replace(index:number,value:any) { const items=[...this.value];items[index]=value;this.valueChange.emit(items); }
 remove(index:number) { this.valueChange.emit(this.value.filter((_:any,i:number)=>i!==index)); }
 move(index:number,direction:number) { const items=[...this.value];[items[index],items[index+direction]]=[items[index+direction],items[index]];this.valueChange.emit(items); }
 add() {
  const templates:Record<string,any>={projects:{id:Date.now(),name:'New project',category:'Personal',eyebrow:'NEW PROJECT',tags:['Angular'],description:'Describe your project.',bullets:['Describe your contribution.'],visual:'asset',image:'',demoUrl:'',sourceUrl:''},experience:{role:'New role',company:'Company name',dates:'Dates',current:false,bullets:['Describe your work.']},skills:{label:'New skill group',items:['New skill']}};
  const item=structuredClone(templates[this.field] || 'New item');
  this.valueChange.emit(templates[this.field] ? [item,...this.value] : [...this.value,item]);
 }
 longField():boolean { return ['description','summary','intro','bullets','paragraphs','contactDescription'].includes(this.field); }
 isMedia():boolean {return ['portrait','image','gif'].includes(this.field);}
 safeImage(value:string):string {return /^(https:\/\/|data:image\/(png|jpeg|gif|webp);base64,)/i.test(value) || /^[\w./-]+$/.test(value) ? value : '';}
 async upload(event:Event) {
  const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size>1_500_000){this.uploadMessage='Please choose a PNG, JPG, WebP or GIF under 1.5 MB.';input.value='';return;}
  const reader=new FileReader();reader.onload=()=>{this.valueChange.emit(String(reader.result));this.uploadMessage='Image added. Save your changes to apply it.';};reader.onerror=()=>this.uploadMessage='Could not read this file. Please try another image.';reader.readAsDataURL(file);
 }
}
