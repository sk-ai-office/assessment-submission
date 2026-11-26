import http from 'node:http';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createStore,DEMO_ACCOUNTS,fail} from './store.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function createApp({dbPath=resolve(root,'data/families.sqlite'),providers,staticDir=resolve(root,'dist')}={}) {
  providers ||= JSON.parse(readFileSync(resolve(root,'server/providers.json'),'utf8'));
  const store=createStore(dbPath,providers),sessions=new Map();
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    const host=req.headers.host||'';
    if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)){res.writeHead(403);return res.end('Local pilot only.');}
    const url=new URL(req.url,'http://'+host),pathname=url.pathname;
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      if(pathname.startsWith('/api/')) {
        let input={};
        if(req.method!=='GET') {
          if(!['POST','PUT','PATCH','DELETE'].includes(req.method))fail(405,'Method not allowed.');
          if(req.headers['x-childcare-client']!=='local-pilot')fail(403,'Request verification failed.');
          const origin=req.headers.origin;if(origin&&!['http://'+host,'http://127.0.0.1:5173','http://localhost:5173'].includes(origin))fail(403,'This request came from another site.');
          if(!(req.headers['content-type']||'').startsWith('application/json'))fail(415,'JSON request required.');
          let size=0,parts=[];for await(const part of req){size+=part.length;if(size>64000)fail(413,'Request is too large.');parts.push(part);}
          try{input=JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{fail(400,'Invalid JSON.');}
        }
        if(pathname==='/api/health')return json(200,{ok:true,mode:'local-pilot'});
        if(pathname==='/api/demo/session'&&req.method==='POST') {
          const u=store.account(input.accountId),token=randomBytes(32).toString('hex');sessions.set(token,{user:u,expires:Date.now()+12*60*60*1000});
          res.setHeader('Set-Cookie',`childcare_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);return json(200,{user:u,accounts:DEMO_ACCOUNTS});
        }
        const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('childcare_session='))?.split('=')[1];
        const session=sessions.get(token);
        if(pathname==='/api/session'&&req.method==='GET'&&(!session||session.expires<Date.now()))return json(200,{user:null,accounts:DEMO_ACCOUNTS});
        if(!session||session.expires<Date.now())fail(401,'Your local session ended. Choose a demo account again.');const u=session.user;
        if(pathname==='/api/session'&&req.method==='GET')return json(200,{user:u,accounts:DEMO_ACCOUNTS});
        if(pathname==='/api/providers'&&req.method==='GET')return json(200,store.getProviders());
        if(pathname==='/api/profile'&&req.method==='GET')return json(200,store.getProfile(u));
        if(pathname==='/api/profile'&&req.method==='PUT')return json(200,store.updateProfile(u,input.profile,input.version));
        if(pathname==='/api/saved'&&req.method==='GET')return json(200,store.saved(u));
        if(pathname==='/api/saved'&&req.method==='PUT')return json(200,store.save(u,input.providerId,input.saved===true));
        if(pathname==='/api/applications'&&req.method==='GET')return json(200,store.list(u));
        if(pathname==='/api/applications'&&req.method==='POST')return json(201,store.apply(u,input));
        if(pathname==='/api/provider/availability'&&req.method==='PUT')return json(200,store.updateAvailability(u,input));
        const match=pathname.match(/^\/api\/applications\/([a-zA-Z0-9-]+)(\/share)?$/);
        if(match){if(req.method==='GET'&&!match[2])return json(200,store.get(u,match[1]));if(req.method==='POST'&&match[2])return json(200,store.refresh(u,match[1],input));if(req.method==='PATCH'&&!match[2])return json(200,store.update(u,match[1],input));}
        fail(404,'Endpoint not found.');
      }
      if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'Method not allowed.');
      const dir=resolve(staticDir),p=resolve(dir,'.'+decodeURIComponent(pathname));
      if(p!==dir&&!p.startsWith(dir+sep))fail(404,'Not found.');
      const target=existsSync(p)&&statSync(p).isFile()?p:resolve(dir,'index.html');
      if(!existsSync(target))fail(503,'Build the dashboard first with npm run build.');
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};
      res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':extname(target)==='.html'?'no-cache':'public,max-age=3600'});res.end(req.method==='HEAD'?undefined:readFileSync(target));
    } catch(e){json(e.status||500,{error:e.status?e.message:'Something went wrong. Please try again.'});if(!e.status)console.error(e);}
  });
  return {server,store};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.CHILDCARE_PORT||4180);const app=createApp();app.server.listen(port,'127.0.0.1',()=>console.log(`Child Care Saskatchewan · local pilot\nhttp://127.0.0.1:${port}\nData stays in ${resolve(root,'data')}`));
}
