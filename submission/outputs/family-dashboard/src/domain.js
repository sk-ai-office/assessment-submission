export const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const AREAS = [
  {id:'northeast',name:'Saskatoon northeast',lat:52.158,lon:-106.569},
  {id:'aspen',name:'Aspen Ridge',lat:52.177,lon:-106.542},
  {id:'brighton',name:'Brighton',lat:52.126,lon:-106.535},
  {id:'downtown',name:'Downtown Saskatoon',lat:52.127,lon:-106.666},
  {id:'willowgrove',name:'Willowgrove',lat:52.147,lon:-106.548},
  {id:'evergreen',name:'Evergreen',lat:52.176,lon:-106.57}
];
export function monthsAt(dob,date) { const a=new Date(dob+'T12:00:00Z'), b=new Date(date+'T12:00:00Z'); return (b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth()-(b.getUTCDate()<a.getUTCDate()?1:0); }
export function distanceKm(a,b) {const r=Math.PI/180, dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
export function timeLabel(s) { if(!s)return 'Not provided'; const [h,m]=s.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'am':'pm'}`; }
export function dateLabel(s) { if(!s)return 'Not provided';return new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Regina'}).format(new Date(s.length===10?s+'T12:00:00Z':s)); }
export function ageLabel(n) {return n<24?`${n} months`:`${Math.floor(n/12)} years${n%12?`, ${n%12} months`:''}`;}
export function matchProvider(p,child,startDate) {
  const age=child?.dob?monthsAt(child.dob,startDate||child.startDate):null;
  const ageKnown=(p.minAgeMonths!=null||p.minAgeDays!=null)&&p.maxAgeMonths!=null;
  const ageDays=child?.dob?Math.floor((new Date((startDate||child.startDate)+'T12:00:00Z')-new Date(child.dob+'T12:00:00Z'))/86400000):null;
  const ageFit=age==null||(p.minAgeDays!=null?ageDays>=p.minAgeDays:p.minAgeMonths!=null?age>=p.minAgeMonths:true)&&(p.maxAgeMonths==null||age<=p.maxAgeMonths);
  const hours=age!=null&&age<18&&p.infantHours?p.infantHours:p;
  const scheduleKnown=!!(hours.open&&hours.close&&p.days);
  const scheduleFit=!child||!scheduleKnown||child.days.every(d=>p.days.includes(d))&&child.startTime>=hours.open&&child.endTime<=hours.close;
  return {age,ageFit,ageKnown,scheduleFit,scheduleKnown};
}
export function availability(p) {return p.availability==='accepting'?{label:'Accepting applications',kind:'positive'}:p.availability==='closed'?{label:'Waitlist closed',kind:'neutral'}:{label:'Availability unconfirmed',kind:'unknown'};}
export const STATUS = {
  submitted:{label:'Sent to provider',next:'Waiting for the provider to review your request.'},
  received:{label:'Received by provider',next:'The provider has acknowledged your application.'},
  needs_info:{label:'More information needed',next:'Read the provider’s request and reply below.'},
  waitlisted:{label:'Waitlist confirmed',next:'The provider has confirmed your place on their waiting list. A care space is not guaranteed.'},
  offered:{label:'Offer received',next:'Review the offer details with the provider before confirming enrolment.'},
  enrolled:{label:'Placement confirmed',next:'The provider has confirmed enrolment. Review your other applications.'},
  declined:{label:'Unable to offer care',next:'See the provider’s explanation. You can continue exploring other options.'},
  withdrawn:{label:'Withdrawn',next:'This provider no longer has access to your shared profile.'}
};
export const TRANSITIONS={submitted:['received','needs_info','waitlisted','declined'],received:['needs_info','waitlisted','offered','declined'],needs_info:['received','waitlisted','declined'],waitlisted:['needs_info','offered','declined'],offered:['enrolled','needs_info','declined'],enrolled:[],declined:[],withdrawn:[]};
