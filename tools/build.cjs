const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const dist=path.join(root,'dist');
const artifacts=path.join(root,'artifacts');
const exportIndex=process.argv.indexOf('--export');
const out=exportIndex>=0?path.resolve(process.argv[exportIndex+1]):path.join(artifacts,'export');
const python=process.env.PDF_PYTHON||'python3';
const briefs=require(path.join(dist,'briefs.js'));
const data=JSON.parse(fs.readFileSync(path.join(root,'data/listening.json'),'utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/reference-registry.json'),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(root,'data/sharing.json'),'utf8'));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fs.mkdirSync(artifacts,{recursive:true});fs.mkdirSync(out,{recursive:true});
const folder=path.join(dist,'complaint-briefs');fs.mkdirSync(folder,{recursive:true});
for(const i of data.issues)if(registry.issues[i.id]!==i.referenceId)throw Error('Changed complaint reference: '+i.id);
for(const e of data.observations)if(registry.evidence[e.id]!==e.referenceId||registry.issues[e.issueId]!==e.complaintReferenceId)throw Error('Changed evidence reference: '+e.id);
const packets=[...data.issues].sort((a,b)=>a.priority-b.priority).map(i=>briefs.pack(data,i.id));
const packetFile=path.join(artifacts,'packets.json');fs.writeFileSync(packetFile,JSON.stringify(packets));
const pdfResult=spawnSync(python,[path.join(__dirname,'build_pdfs.py'),packetFile,folder],{encoding:'utf8'});
if(pdfResult.status!==0)throw Error(pdfResult.stderr||'PDF generation failed. Install tools/requirements.txt or set PDF_PYTHON.');
process.stdout.write(pdfResult.stdout);
const pdfs={};
const entries=[];
for(const packet of packets){
  const i=packet.issue;pdfs[i.referenceId]=fs.readFileSync(path.join(folder,i.referenceId+'.pdf')).toString('base64');
  fs.writeFileSync(path.join(folder,i.referenceId+'.html'),briefs.html(packet,pdfs[i.referenceId]));
  fs.writeFileSync(path.join(folder,i.referenceId+'.txt'),briefs.text(packet));
  fs.writeFileSync(path.join(folder,i.referenceId+'.json'),JSON.stringify(packet,null,2));
  entries.push(`<tr><td><a href="${i.referenceId}.html">${i.referenceId}</a></td><td><a href="${i.referenceId}.html">${esc(i.concern)}</a><small>${esc(i.ministry)} · ${packet.counts.evidenceRecords} evidence records</small></td><td>${packet.counts.publicAccounts}</td><td><a href="${i.referenceId}.pdf" download>PDF</a> · <a href="${i.referenceId}.txt" download>Text</a></td></tr>`);
}
fs.writeFileSync(path.join(dist,'pdfs.js'),'window.COMPLAINT_PDFS = '+JSON.stringify(pdfs)+';\n');
fs.writeFileSync(path.join(dist,'sharing-config.js'),'window.SHARING_CONFIG = '+JSON.stringify(config)+';\n');
fs.writeFileSync(path.join(dist,'listening-data.js'),'window.LISTENING = '+JSON.stringify(data).replace(/</g,'\\u003c')+';\n');
fs.copyFileSync(path.join(root,'data/dashboard-template.html'),path.join(dist,'index.html'));
fs.writeFileSync(path.join(folder,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Saskatchewan complaint briefs</title><style>body{font:16px/1.5 system-ui;color:#243b2b;max-width:1050px;margin:auto;padding:32px 20px}h1{line-height:1.2}p{color:#556b58}a{color:#6d4c1b;text-underline-offset:3px}table{border-collapse:collapse;width:100%;margin-top:25px}th,td{text-align:left;padding:14px 10px;border-bottom:1px solid #ccd8c6;vertical-align:top}th{font-size:12px}small{display:block;font-size:12px;color:#647261;margin-top:5px}td:first-child{white-space:nowrap}td:nth-child(3){text-align:center}td:nth-child(4){font-size:12px}footer{margin-top:30px;font-size:12px;color:#647261}@media(max-width:600px){th,td{padding:12px 5px;font-size:13px}th{font-size:10px}h1{font-size:27px}}</style></head><body><h1>Complaint briefs</h1><p>${data.issues.length} concerns · ${data.observations.length} evidence records · Sources reviewed ${esc(data.reviewedAt)}</p><p>Each brief includes the complete concern, evidence, ministry responsibility and proposed actions. Download a PDF or share the web-page link.</p><p><strong>SK-C</strong> identifies a concern; <strong>SK-E</strong> identifies an evidence record. These are internal references, not government case numbers.</p><table><thead><tr><th>Reference</th><th>Concern</th><th>Public accounts</th><th>Download</th></tr></thead><tbody>${entries.join('')}</tbody></table><footer>Accounts are not verified individuals. Named people in news are counted separately within each brief. Unverified dates and excluded records remain visible. Independent research for AI Office review; not an official government publication.</footer></body></html>`);
fs.writeFileSync(path.join(folder,'READ-ME.txt'),`SASKATCHEWAN COMPLAINT BRIEFS\n\nOpen index.html for all 28 concerns. Each SK-Cxxx.pdf, .html, .txt and .json includes the complete concern and evidence. HTML files include their own PDF download and work independently of the dashboard.\n\nSK-C identifies a grouped concern; SK-E identifies an evidence record. They are permanent internal references, not official government case numbers.\n\nSource snapshot: ${data.reviewedAt}. Review window: ${data.start} to ${data.end}.\n50 distinct public accounts and 25 named people in reporting are separate counts and may overlap. Accounts are not verified individuals. Platform gaps and date limits are labelled.\n\n${config.published?'Public dashboard: '+config.publicBaseUrl:'Public links are pending publication.'}\n`);
let standalone=fs.readFileSync(path.join(dist,'index.html'),'utf8');
standalone=standalone.replace('<link rel="stylesheet" href="listening.css">',()=>'<style>'+fs.readFileSync(path.join(dist,'listening.css'),'utf8')+'</style>');
for(const name of ['listening-data.js','briefs.js','pdfs.js','sharing-config.js','listening.js']){
  const code=fs.readFileSync(path.join(dist,name),'utf8').replace(/<\/script/gi,'<\\/script');
  standalone=standalone.replace(`<script src="${name}"></script>`,()=>'<script>'+code+'</script>');
}
fs.writeFileSync(path.join(out,'saskatchewan-service-complaints.html'),standalone);
fs.cpSync(folder,path.join(out,'complaint-briefs'),{recursive:true});
fs.copyFileSync(path.join(root,'data/listening.json'),path.join(out,'saskatchewan-complaints-data.json'));
function csv(rows,fields){const q=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return '\uFEFF'+[fields,...rows.map(r=>fields.map(k=>r[k]))].map(r=>r.map(q).join(',')).join('\r\n');}
fs.writeFileSync(path.join(out,'complaint-evidence.csv'),csv(data.observations,['referenceId','complaintReferenceId','id','issueId','platform','authorId','authorHandle','authorType','sourceRole','counted','date','dateLabel','datePrecision','quote','summary','url','sourcePage','sourceTitle','publisher','status','context','verification']));
const issueRows=packets.map(p=>({...p.issue,public_accounts:p.counts.publicAccounts,named_in_reporting:p.counts.namedInReporting,uncounted_social_records:p.counts.uncountedRecords,source_urls:[...new Set(p.evidence.map(e=>e.url))].join(' | ')}));
fs.writeFileSync(path.join(out,'complaint-issues.csv'),csv(issueRows,['referenceId','id','concern','why','public_accounts','named_in_reporting','uncounted_social_records','ministry','service','fit','idea','limit','firstStep','measure','reason','source_urls']));
const zip=spawnSync(python,['-c',`from pathlib import Path
import zipfile,sys
out=Path(sys.argv[1])
with zipfile.ZipFile(out/'saskatchewan-complaint-briefs.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((out/'complaint-briefs').iterdir()): z.write(p,p.name)
 for name in ['complaint-issues.csv','complaint-evidence.csv','saskatchewan-complaints-data.json']: z.write(out/name,name)
 z.write(out/'saskatchewan-service-complaints.html','dashboard.html')
`,out],{encoding:'utf8'});
if(zip.status!==0)throw Error(zip.stderr);
console.log('Built complete static site, standalone dashboard and share bundle in '+out);
