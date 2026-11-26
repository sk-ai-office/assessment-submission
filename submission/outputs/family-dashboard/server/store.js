import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DAYS,monthsAt,matchProvider,TRANSITIONS} from '../src/domain.js';

export const DEMO_ACCOUNTS=[
  {id:'family-morgan',name:'Morgan family',role:'family'},
  {id:'family-other',name:'Taylor family',role:'family'},
  {id:'provider-sprouts',name:'Prairie Sprouts · example provider',role:'provider',providerId:'demo-sprouts'},
  {id:'provider-willow',name:'Little Willow · example provider',role:'provider',providerId:'demo-willow'}
];
export const fail=(code,message)=>{const e=new Error(message);e.status=code;throw e;};
const text=(v,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!Number.isNaN(new Date(v+'T12:00:00Z').valueOf())&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const validTime=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v||'');
export function validateProfile(p) {
  if(!text(p.name)||!/^\S+@\S+\.\S+$/.test(p.email||''))fail(400,'Enter your name and a valid email address.');
  if(!Array.isArray(p.children)||p.children.length<1||p.children.length>8)fail(400,'Add between one and eight children.');
  const ids=new Set();
  const children=p.children.map(c=>{
    if(!text(c.name)||!validDate(c.dob)||!validDate(c.startDate)||monthsAt(c.dob,c.startDate)<0||monthsAt(c.dob,c.startDate)>216)fail(400,'Check each child’s name, birth date and care start date.');
    if(!validTime(c.startTime)||!validTime(c.endTime)||c.startTime>=c.endTime)fail(400,'The end time must be after the start time.');
    if(!Array.isArray(c.days)||!c.days.length||c.days.some(d=>!DAYS.includes(d)))fail(400,'Select at least one valid care day.');
    const id=text(c.id,80)||randomUUID();if(ids.has(id))fail(400,'Each child must have a unique record.');ids.add(id);
    return {id,name:text(c.name,80),dob:c.dob,startDate:c.startDate,startTime:c.startTime,endTime:c.endTime,days:[...new Set(c.days)],flexible:!!c.flexible,notes:text(c.notes,1200)};
  });
  return {name:text(p.name,100),email:text(p.email,150),phone:text(p.phone,30),postalCode:text(p.postalCode,12).toUpperCase(),preferredContact:['Email','Phone','Either'].includes(p.preferredContact)?p.preferredContact:'Email',children};
}
export function createStore(path,providers=[]) {
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const db=new DatabaseSync(path);db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS families(id TEXT PRIMARY KEY,profile TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS providers(id TEXT PRIMARY KEY,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,provider_id TEXT NOT NULL,child_id TEXT NOT NULL,snapshot TEXT NOT NULL,profile_version INTEGER NOT NULL,status TEXT NOT NULL,sharing INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(family_id) REFERENCES families(id),FOREIGN KEY(provider_id) REFERENCES providers(id));
    CREATE UNIQUE INDEX IF NOT EXISTS active_application ON applications(family_id,provider_id,child_id) WHERE status NOT IN ('withdrawn','declined');
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,application_id TEXT NOT NULL,actor TEXT NOT NULL,kind TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(application_id) REFERENCES applications(id));
    CREATE TABLE IF NOT EXISTS saved(family_id TEXT NOT NULL,provider_id TEXT NOT NULL,PRIMARY KEY(family_id,provider_id));
    CREATE TABLE IF NOT EXISTS provider_updates(provider_id TEXT PRIMARY KEY,availability TEXT NOT NULL,updated_at TEXT NOT NULL);
  `);
  for(const p of providers)db.prepare('INSERT INTO providers VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(p.id,JSON.stringify(p));
  for(const [id,name,child] of [['family-morgan','Morgan Chen','Avery'],['family-other','Taylor Ellis','Rowan']]) db.prepare('INSERT OR IGNORE INTO families VALUES(?,?,1)').run(id,JSON.stringify({name,email:id+'@example.test',phone:'',postalCode:'S7N 5A3',preferredContact:'Email',children:[{id:id+'-child-1',name:child,dob:'2024-08-14',startDate:'2026-12-07',days:DAYS.slice(0,5),startTime:'08:00',endTime:'17:00',flexible:false,notes:''}]}));
  const account=id=>DEMO_ACCOUNTS.find(x=>x.id===id)||fail(401,'Select a local demo account.');
  const mustFamily=u=>{if(u.role!=='family')fail(403,'Only a family can manage its profile.');};
  const getProfile=u=>{mustFamily(u);const r=db.prepare('SELECT * FROM families WHERE id=?').get(u.id);return {...JSON.parse(r.profile),version:r.version};};
  const getProviders=()=>db.prepare('SELECT * FROM providers').all().map(r=>{const p=JSON.parse(r.data),a=db.prepare('SELECT * FROM provider_updates WHERE provider_id=?').get(p.id);return a?{...p,availability:a.availability,availabilityUpdated:a.updated_at}:p;});
  const getProvider=id=>getProviders().find(p=>p.id===id)||fail(404,'Provider not found.');
  const event=(id,u,kind,message)=>db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(randomUUID(),id,u.role==='provider'?'Provider':'Family',kind,text(message,2000),new Date().toISOString());
  const rowAccess=(u,id)=>{const r=db.prepare('SELECT * FROM applications WHERE id=?').get(id);if(!r||!(u.role==='family'&&r.family_id===u.id||u.role==='provider'&&r.provider_id===u.providerId))fail(404,'Application not found.');return r;};
  const serialize=(u,r)=>({id:r.id,providerId:r.provider_id,childId:u.role==='family'?r.child_id:undefined,status:r.status,sharing:!!r.sharing,profileVersion:r.profile_version,createdAt:r.created_at,updatedAt:r.updated_at,profile:r.sharing||u.role==='family'?JSON.parse(r.snapshot):null,events:r.sharing||u.role==='family'?db.prepare('SELECT actor,kind,message,created_at AS createdAt FROM events WHERE application_id=? ORDER BY created_at,rowid').all(r.id):[],provider:getProvider(r.provider_id)});
  const snapshot=(p,c,notes)=>({parent:{name:p.name,email:p.email,phone:p.phone,postalCode:p.postalCode,preferredContact:p.preferredContact},child:{...c,notes:notes?c.notes:''},supportIncluded:!!notes});
  return {
    db,account,getProfile,getProviders,getProvider,
    updateProfile(u,p,version){mustFamily(u);const clean=validateProfile(p),old=getProfile(u);if(old.version!==version)fail(409,'This profile changed in another window. Reload before saving.');
      const active=db.prepare("SELECT child_id FROM applications WHERE family_id=? AND sharing=1").all(u.id);if(active.some(a=>!clean.children.some(c=>c.id===a.child_id)))fail(400,'Withdraw applications before removing a child who has shared applications.');
      db.prepare('UPDATE families SET profile=?,version=version+1 WHERE id=?').run(JSON.stringify(clean),u.id);return getProfile(u);},
    saved(u){mustFamily(u);return db.prepare('SELECT provider_id FROM saved WHERE family_id=?').all(u.id).map(x=>x.provider_id);},
    save(u,id,on){mustFamily(u);getProvider(id);if(on)db.prepare('INSERT OR IGNORE INTO saved VALUES(?,?)').run(u.id,id);else db.prepare('DELETE FROM saved WHERE family_id=? AND provider_id=?').run(u.id,id);return this.saved(u);},
    list(u){const rows=u.role==='family'?db.prepare('SELECT * FROM applications WHERE family_id=? ORDER BY updated_at DESC').all(u.id):db.prepare('SELECT * FROM applications WHERE provider_id=? ORDER BY updated_at DESC').all(u.providerId);return rows.map(r=>serialize(u,r));},
    get(u,id){return serialize(u,rowAccess(u,id));},
    apply(u,input){mustFamily(u);if(input.consent!==true)fail(400,'Review and confirm sharing before applying.');const p=getProfile(u);if(input.profileVersion!==p.version)fail(409,'Your profile changed. Review the latest version before applying.');
      const provider=getProvider(input.providerId);if(!provider.demo||!provider.connected)fail(400,'This provider uses an external application. No profile has been sent.');if(provider.availability==='closed')fail(400,'This provider’s waitlist is closed.');
      const c=p.children.find(c=>c.id===input.childId);if(!c)fail(400,'Choose a child from your profile.');const m=matchProvider(provider,c,c.startDate);if(!m.ageFit)fail(400,'This child is outside the provider’s age range on the start date.');
      if(db.prepare("SELECT id FROM applications WHERE family_id=? AND provider_id=? AND child_id=? AND status NOT IN ('withdrawn','declined')").get(u.id,provider.id,c.id))fail(409,'An active application already exists for this child and provider.');
      const id=randomUUID(),now=new Date().toISOString();db.exec('BEGIN');try{db.prepare('INSERT INTO applications VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,u.id,provider.id,c.id,JSON.stringify(snapshot(p,c,input.shareNotes===true)),p.version,'submitted',1,now,now);event(id,u,'submitted','Application sent through the local pilot. Awaiting provider acknowledgement.');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return this.get(u,id);},
    refresh(u,id,input){mustFamily(u);const r=rowAccess(u,id);if(!r.sharing)fail(400,'Sharing has ended for this application.');if(input.consent!==true)fail(400,'Confirm sharing the latest profile.');const p=getProfile(u);if(p.version!==input.profileVersion)fail(409,'The profile changed. Review again.');const c=p.children.find(c=>c.id===r.child_id);if(!c)fail(400,'Child no longer exists.');db.prepare('UPDATE applications SET snapshot=?,profile_version=?,updated_at=? WHERE id=?').run(JSON.stringify(snapshot(p,c,input.shareNotes===true)),p.version,new Date().toISOString(),id);event(id,u,'profile_updated','Family shared an updated profile and care schedule.');return this.get(u,id);},
    update(u,id,input){const r=rowAccess(u,id);if(input.action==='withdraw'){mustFamily(u);if(!r.sharing)fail(400,'Application is already withdrawn.');db.prepare("UPDATE applications SET status='withdrawn',sharing=0,updated_at=? WHERE id=?").run(new Date().toISOString(),id);event(id,u,'withdrawn','Family withdrew the application and ended profile access.');}
      else if(input.action==='message'){if(!r.sharing)fail(400,'Sharing has ended.');if(!text(input.message))fail(400,'Enter a message.');event(id,u,'message',input.message);db.prepare('UPDATE applications SET updated_at=? WHERE id=?').run(new Date().toISOString(),id);}
      else {if(u.role!=='provider')fail(403,'Only the receiving provider can confirm an application status.');if(!r.sharing||!TRANSITIONS[r.status]?.includes(input.status))fail(400,'That status change is not available.');if(['needs_info','offered','enrolled','declined'].includes(input.status)&&!text(input.message))fail(400,'Add a clear explanation or next step for the family.');db.prepare('UPDATE applications SET status=?,updated_at=? WHERE id=?').run(input.status,new Date().toISOString(),id);event(id,u,input.status,input.message||'Provider updated the application status.');}return this.get(u,id);},
    updateAvailability(u,input){if(u.role!=='provider')fail(403,'Provider access required.');if(!['unknown','accepting','closed'].includes(input.availability))fail(400,'Choose a valid availability state.');db.prepare('INSERT INTO provider_updates VALUES(?,?,?) ON CONFLICT(provider_id) DO UPDATE SET availability=excluded.availability,updated_at=excluded.updated_at').run(u.providerId,input.availability,new Date().toISOString());return getProvider(u.providerId);}
  };
}
