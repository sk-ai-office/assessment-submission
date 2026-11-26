const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'outputs');
const dist=path.join(__dirname,'saskatchewan-dashboard/dist');
const briefs=require(path.join(dist,'briefs.js'));
const data=JSON.parse(fs.readFileSync(path.join(out,'saskatchewan-complaints-data.json'),'utf8'));
const folder=path.join(out,'complaint-briefs');
fs.mkdirSync(folder,{recursive:true});
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="listening.css">',()=>'<style>'+fs.readFileSync(path.join(dist,'listening.css'),'utf8')+'</style>');
for(const name of ['listening-data.js','briefs.js','listening.js']){
  const code=fs.readFileSync(path.join(dist,name),'utf8').replace(/<\/script/gi,'<\\/script');
  html=html.replace(`<script src="${name}"></script>`,()=>'<script>'+code+'</script>');
}
fs.writeFileSync(path.join(out,'saskatchewan-service-complaints.html'),html);
fs.writeFileSync(path.join(dist,'standalone.html'),html);
const entries=[];
for(const issue of [...data.issues].sort((a,b)=>a.priority-b.priority)){
  const packet=briefs.pack(data,issue.id);
  fs.writeFileSync(path.join(folder,issue.referenceId+'.html'),briefs.html(packet));
  fs.writeFileSync(path.join(folder,issue.referenceId+'.txt'),briefs.text(packet));
  entries.push(`<tr><td><a href="${issue.referenceId}.html">${issue.referenceId}</a></td><td><a href="${issue.referenceId}.html">${esc(issue.concern)}</a><small>${esc(issue.ministry)} · ${packet.counts.evidenceRecords} evidence records</small></td><td>${packet.counts.publicAccounts}</td><td><a href="${issue.referenceId}.txt">Text version</a></td></tr>`);
}
fs.writeFileSync(path.join(folder,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Saskatchewan complaint briefs</title><style>body{font:16px/1.5 system-ui;color:#243b2b;max-width:1050px;margin:auto;padding:32px 20px}h1{line-height:1.2}p{color:#556b58}a{color:#6d4c1b;text-underline-offset:3px}table{border-collapse:collapse;width:100%;margin-top:25px}th,td{text-align:left;padding:14px 10px;border-bottom:1px solid #ccd8c6;vertical-align:top}th{font-size:12px}small{display:block;font-size:12px;color:#647261;margin-top:5px}td:first-child{white-space:nowrap}td:nth-child(3){text-align:center}td:nth-child(4){font-size:12px}footer{margin-top:30px;font-size:12px;color:#647261}@media(max-width:600px){th,td{padding:12px 5px;font-size:13px}th{font-size:10px}h1{font-size:27px}}</style></head><body><h1>Complaint briefs</h1><p>28 concerns · 80 evidence records · Sources reviewed ${esc(data.reviewedAt)}</p><p>Open a reference below for the complete concern, evidence, ministry responsibility and proposed actions. Each HTML file is self-contained and can be attached separately, printed or saved as PDF. Text versions are ready to paste into a message.</p><p><strong>SK-C</strong> identifies a grouped concern; <strong>SK-E</strong> identifies an evidence record. These are internal references, not government case numbers. Counts are public accounts from the reviewed sample, not verified individuals.</p><table><thead><tr><th>Reference</th><th>Concern</th><th>Public accounts</th><th>Copyable version</th></tr></thead><tbody>${entries.join('')}</tbody></table><footer>Named people in news are counted separately within each brief. Unverified dates and excluded records remain visible. Independent research for AI Office review; not an official government publication.</footer></body></html>`);
fs.writeFileSync(path.join(folder,'READ-ME.txt'),`SASKATCHEWAN COMPLAINT BRIEFS\n\nOpen index.html for all 28 concerns.\nEach SK-Cxxx.html is a complete standalone brief: attach it to share one concern.\nEach matching .txt contains the complete copyable text.\nHTML briefs offer Print / Save PDF and Download evidence data.\n\nSK-C is the permanent grouped-concern reference; SK-E is the permanent evidence-record reference. Original record IDs are preserved. IDs remain stable when titles, sorting or filters change. They are not official government case numbers.\n\nThe bundle also contains the complete dashboard, research data, and CSVs with the same IDs. No public site is required. Original-source links still need an internet connection. All brief content itself is stored in the files.\n\nSource snapshot: ${data.reviewedAt}. Review window: ${data.start} to ${data.end}.\n50 distinct public accounts, 25 named people in reporting (separate; may overlap), 80 evidence records, 28 grouped concerns.\nAccounts are not verified people. X and Quora coverage gaps and undated LinkedIn leads are labelled. Historical or resolved concerns should not be assumed to remain unresolved.\n`);
console.log(`Built ${data.issues.length} HTML briefs, matching text files, reference index and standalone dashboard.`);
