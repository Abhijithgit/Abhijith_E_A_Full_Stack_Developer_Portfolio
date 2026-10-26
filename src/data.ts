import { CONTENT } from './content';
export type PortfolioData = typeof CONTENT;
function validate(value:unknown,shape:unknown,path='Portfolio'):void {
 if(Array.isArray(shape)) {
  if(!Array.isArray(value) || value.length>100)throw new Error(`${path}: use a list with up to 100 items.`);
  for(const item of value)validate(item,shape[0],path);
 } else if(shape!==null && typeof shape==='object') {
  if(value===null || typeof value!=='object' || Array.isArray(value))throw new Error(`${path}: invalid section.`);
  for(const [key,child] of Object.entries(shape))validate((value as Record<string,unknown>)[key],child,`${path} / ${key}`);
 } else if(typeof value!==typeof shape || (typeof value==='string' && value.length>2_100_000))throw new Error(`${path}: invalid field.`);
}
export function checkedData(value:unknown):PortfolioData {
 validate(value,CONTENT);const data=value as PortfolioData;
 if(!data.profile.name.trim())throw new Error('Please enter your name.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.profile.email))throw new Error('Please enter a valid email address.');
 if(!/^#[0-9a-f]{6}$/i.test(data.appearance.accent))throw new Error('Choose a valid accent colour.');
 const ids=new Set<number>();
 for(const project of data.projects){
  if(!project.name.trim() || !['Personal','Professional'].includes(project.category))throw new Error('Each project needs a name and category.');
  if(!Number.isFinite(project.id) || ids.has(project.id))throw new Error('Project IDs must be unique. Add new projects using the Add project button.');ids.add(project.id);
 }
 return structuredClone(data);
}
