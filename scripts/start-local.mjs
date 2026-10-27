import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const comspec=process.env.ComSpec||'cmd.exe';
const run=(command,args,options={})=>spawn(command,args,{cwd:root,stdio:'inherit',...options});
async function finish(child){return new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code)=>resolve(code??1))})}
function setting(text,name){const line=text.split(/\r?\n/).find(line=>line.trim().startsWith(name+'='));return line?.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2')??''}
async function freePort(){for(let port=3000;port<=3020;port++){const available=await new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)))});if(available)return port}throw Error('No local port is available from 3000 through 3020. Close an old app window and try again.')}
async function main(){
  if(Number(process.versions.node.split('.')[0])<22)throw Error('Please install Node.js 22 or later from https://nodejs.org/.');
  const envFile=fs.existsSync('.env.local')?'.env.local':fs.existsSync('.env')?'.env':'.env.local';
  if(!fs.existsSync(envFile))fs.copyFileSync('.env.example',envFile);
  const config=fs.readFileSync(envFile,'utf8');
  if(!setting(config,'NEXT_PUBLIC_SUPABASE_URL')||!setting(config,'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')){
    console.log('First-time setup: add your Supabase publishable key in the file that opens.');
    console.log('Save it, then double-click Start-Checklist.bat again. Database setup is described in README.md.');
    const editor=run('notepad.exe',[path.join(root,envFile)],{stdio:'ignore'});editor.on('error',()=>console.log('Open '+envFile+' manually in a text editor.'));
    process.exitCode=1;return;
  }
  const hash=crypto.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex');
  const stamp='node_modules/.checklist-launcher-lock';
  if(!fs.existsSync('node_modules/next/dist/bin/next')||!fs.existsSync(stamp)||fs.readFileSync(stamp,'utf8')!==hash){
    console.log('Installing project dependencies. This may take a few minutes the first time.');
    const code=await finish(run(comspec,['/d','/s','/c','npm.cmd ci']));
    if(code!==0)throw Error('Dependency installation failed. Check your internet connection and try again.');
    fs.writeFileSync(stamp,hash);
  }
  const port=await freePort(),url='http://127.0.0.1:'+port;
  console.log('Starting DC Daily Checklist at '+url);
  console.log('Keep this window open. Press Ctrl+C to stop the project.');
  let stopped=false;
  const server=run(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)]);
  server.once('exit',()=>{stopped=true});
  const ready=(async()=>{for(let attempt=0;attempt<90&&!stopped;attempt++){
    try{const response=await fetch(url,{signal:AbortSignal.timeout(1500)});if(response.ok&&(await response.text()).includes('DC Daily Checklist')){
      if(!stopped){
        const fallback=()=>console.log('Open '+url+' in your browser.');
        const browser=run('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',"Start-Process -FilePath '"+url+"'"],{stdio:'ignore',windowsHide:true});
        browser.once('error',fallback);
        browser.once('exit',code=>{if(code!==0)fallback()});
      }return;
    }}catch{}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }if(!stopped)console.log('The browser could not open automatically. Open '+url+' when the server is ready.');})();
  const code=await finish(server);stopped=true;await ready;process.exitCode=code;
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
