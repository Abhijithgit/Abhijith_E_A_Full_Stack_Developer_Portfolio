import { randomBytes, scrypt as derive, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
const scrypt=promisify(derive);
export const OWNER_ID='Abhijithea';
export const digest=value=>createHash('sha256').update(value).digest('hex');
export async function readOwner(directory){try{return JSON.parse(await readFile(path.join(directory,'owner.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
export async function passwordRecord(userId,password){
 if(userId!==OWNER_ID)throw new Error('This portfolio is configured for owner ID '+OWNER_ID+'.');
 if(typeof password!=='string'||password.length<12||password.length>128)throw new Error('Use a password or passphrase between 12 and 128 characters.');
 const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return {userId,salt,hash:hash.toString('hex'),version:randomBytes(16).toString('hex')};
}
export async function verifyPassword(owner,userId,password){
 const valid=owner&&typeof password==='string'&&password.length<=128;
 const actual=await scrypt(valid?password:'invalid',owner?.salt||'00'.repeat(16),64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return timingSafeEqual(actual,Buffer.from(owner?.hash||'00'.repeat(64),'hex'))&&valid&&timingSafeEqual(Buffer.from(digest(userId)),Buffer.from(digest(owner.userId)));
}
export async function createOwner(directory,userId,password){
 await mkdir(directory,{recursive:true,mode:0o700});const record=await passwordRecord(userId,password);
 await writeFile(path.join(directory,'owner.json'),JSON.stringify(record),{flag:'wx',mode:0o600});return record;
}
export async function changePassword(directory,currentPassword,nextPassword){
 const owner=await readOwner(directory);if(!owner||!await verifyPassword(owner,owner.userId,currentPassword))throw new Error('Current password is incorrect.');
 const next=await passwordRecord(owner.userId,nextPassword);const temporary=path.join(directory,'owner.json.tmp');
 await writeFile(temporary,JSON.stringify(next),{mode:0o600});await rename(temporary,path.join(directory,'owner.json'));
}
