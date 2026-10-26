import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { OWNER_ID,createOwner,changePassword,readOwner } from './auth.mjs';
const directory=path.resolve(process.env.PORTFOLIO_DATA_DIR||fileURLToPath(new URL('../.data',import.meta.url)));
async function secret(prompt){
 if(!process.stdin.isTTY)throw new Error('Run setup in an interactive terminal. Do not put passwords in command arguments or environment variables.');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();let value='';
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};
  const onData=chunk=>{for(const char of chunk.toString()){
   if(char==='\u0003'){cleanup();reject(new Error('Cancelled.'));return;}
   if(char==='\r'||char==='\n'){cleanup();resolve(value);return;}
   if(char==='\u007f'||char==='\b')value=value.slice(0,-1);
   else if(char.charCodeAt(0)>=32)value+=char;
  }};process.stdin.on('data',onData);
 });
}
try{
 console.log('Portfolio owner user ID: '+OWNER_ID);
 if(process.argv.includes('--change-password')){
  const current=await secret('Current password (hidden): ');const next=await secret('New password, 12+ characters (hidden): ');const repeat=await secret('Confirm new password (hidden): ');if(next!==repeat)throw new Error('Passwords do not match.');await changePassword(directory,current,next);console.log('Password updated. Existing sessions will be signed out.');
 }else{
  if(await readOwner(directory))throw new Error('The owner is already configured. Use npm run owner:password to change the password.');
  const password=await secret('Choose a password, 12+ characters (hidden): ');const repeat=await secret('Confirm password (hidden): ');if(password!==repeat)throw new Error('Passwords do not match.');await createOwner(directory,OWNER_ID,password);console.log('Owner configured. Start the server and use Owner login.');
 }
}catch(error){console.error(error.message);process.exitCode=1;}
