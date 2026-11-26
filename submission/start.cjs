#!/usr/bin/env node
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=fs.realpathSync(__dirname);
if(Number(process.versions.node.split('.')[0])<24){console.error('Please use Node.js 24 or newer.');process.exit(1);}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.pdf':'application/pdf','.csv':'text/csv; charset=utf-8'};
let child,stopping=false;
const server=http.createServer((req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 const reject=(code,msg)=>{res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8'});res.end(msg);};
 if(!['GET','HEAD'].includes(req.method))return reject(405,'Read-only local server.');
 if(!/^(127\.0\.0\.1|localhost):4182$/.test(req.headers.host||''))return reject(403,'Local access only.');
 let pathname;try{pathname=decodeURIComponent((req.url||'/').split('?')[0]);}catch{return reject(400,'Invalid path.');}
 if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').some(s=>s.startsWith('.')))return reject(403,'Path not available.');
 let file=path.resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+path.sep))return reject(403,'Path not available.');
 try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');file=fs.realpathSync(file);if(!file.startsWith(root+path.sep)||path.relative(root,file).split(path.sep).some(s=>s.startsWith('.'))||!fs.statSync(file).isFile())return reject(403,'Path not available.');const stat=fs.statSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size});if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);}catch{return reject(404,'File not found.');}
});
function stop(code=0){if(stopping)return;stopping=true;server.close();if(child&&!child.killed)child.kill('SIGTERM');setTimeout(()=>{if(child&&child.exitCode===null)child.kill('SIGKILL');process.exit(code);},500).unref();process.exitCode=code;}
server.on('error',e=>{console.error('Could not start the local hub:',e.message);stop(1);});
server.listen(4182,'127.0.0.1',()=>{
 child=spawn(process.execPath,[path.join(root,'outputs/family-dashboard/server/index.js')],{cwd:root,env:{...process.env,CHILDCARE_PORT:'4180'},stdio:'inherit'});
 child.on('error',e=>{console.error('Could not start family dashboard:',e.message);stop(1);});
 child.on('exit',(code)=>{if(!stopping){console.error('Family dashboard stopped.');stop(code||1);}});
 console.log('\nOpen the submission hub: http://127.0.0.1:4182\nFamily/provider app: http://127.0.0.1:4180\nKeep this window open. Press Control-C to stop both servers.\n');
});
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
