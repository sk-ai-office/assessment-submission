'use strict';
(() => {
  const data = window.RESEARCH;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const unique = values => [...new Set(values.filter(Boolean))];
  const issueMap = new Map(data.issues.map(i => [i.id, i]));
  const routeMap = new Map(data.routes.map(r => [r.id, r]));
  const state = {search:'', ministry:'all', source:'all', period:'all', metric:'accounts', sort:'total', visible:12};
  let current = [];
  const sourceUrl = r => r.sourcePage || r.url;
  const sourceCount = records => unique(records.map(sourceUrl)).length;
  const identityCount = (records,type) => unique(records.filter(r=>r.counted && r.authorType===type).map(r=>r.authorId)).length;
  const stats = records => ({people:identityCount(records,'person'),accounts:identityCount(records,'account'),sources:sourceCount(records),records:records.length});
  const dateText = r => r.dateLabel || (r.date ? new Date(r.date+'T12:00:00').toLocaleDateString('en-CA',{day:'numeric',month:'short',year:'numeric'}) : 'Date not verified');
  const dateNote = r => r.datePrecision && !/^(post date|exact|day|thread|month|published|publication date)$/i.test(r.datePrecision) ? r.datePrecision.replaceAll('_',' ') : '';
  const link = (url,label,cls='') => /^https:\/\//.test(url||'') ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
  const shortMinistry = m => m === 'Crown Investments Corporation (oversight)' ? 'Crown corporations / CIC' : m;
  const matches = r => {
    const issue=issueMap.get(r.issueId);
    return (state.ministry==='all'||issue.ministry===state.ministry)
      &&(state.source==='all'||r.authorType===state.source)
      &&(state.period==='all'||r.date?.startsWith(state.period))
      &&(!state.search||[issue.title,issue.summary,issue.service,issue.ministry,r.summary,r.region,r.publisher].join(' ').toLowerCase().includes(state.search));
  };
  function issueRows(records){
    return data.issues.map(issue=>({...issue,items:records.filter(r=>r.issueId===issue.id)})).filter(x=>x.items.length).map(x=>({...x,...stats(x.items)})).sort((a,b)=>{
      const av=state.sort==='total'?a.people+a.accounts:a[state.sort];
      const bv=state.sort==='total'?b.people+b.accounts:b[state.sort];
      return bv-av||a.title.localeCompare(b.title);
    });
  }
  function renderMetrics(){
    const s=stats(current), n=unique(current.map(r=>r.issueId)).length;
    $('metrics').innerHTML=[['Named complainants',s.people,'Distinct people named in sources'],['Public accounts',s.accounts,'Distinct handles · people not verified'],['Complaint themes',n,'Matched to a responsible body'],['Source pages',s.sources,'Public evidence reviewed']].map(([l,n,d])=>`<div class="metric"><div class="metric-label">${l}</div><div class="metric-value">${n}</div><small>${d}</small></div>`).join('');
  }
  function renderChart(rows){
    const ranked=[...rows].filter(r=>r[state.metric]>0).sort((a,b)=>b[state.metric]-a[state.metric]||a.title.localeCompare(b.title)).slice(0,6),max=ranked[0]?.[state.metric]||1;
    $('chart').innerHTML=ranked.length?ranked.map(i=>`<div class="bar-row"><button class="bar-label" data-issue="${i.id}">${esc(i.title)}</button><div class="bar-track" role="img" aria-label="${esc(i.title)}: ${i[state.metric]} ${state.metric==='people'?'named complainants':'public accounts'}"><div class="bar-fill" style="width:${i[state.metric]/max*100}%"></div></div><span class="bar-count">${i[state.metric]}</span></div>`).join(''):'<div class="empty">No counted identities of this type match the filters.</div>';
  }
  function renderRespond(rows){
    const bodies=unique(rows.map(i=>i.ministry)).map(ministry=>({ministry,count:rows.filter(i=>i.ministry===ministry).length})).sort((a,b)=>b.count-a.count);
    $('respond-list').innerHTML=bodies.map(b=>`<div class="respond-item">${esc(shortMinistry(b.ministry))}<span>${b.count} ${b.count===1?'theme':'themes'}</span></div>`).join('')||'<p class="empty">No matching organizations</p>';
  }
  function renderIssues(rows){
    $('filter-status').textContent=`${rows.length} themes · ${current.length} evidence records · ${sourceCount(current)} source pages${state.search||state.ministry!=='all'||state.source!=='all'||state.period!=='all'?' · Filters apply to counts, chart and evidence below':''}`;
    $('issue-rows').innerHTML=rows.length?rows.map(i=>`<tr><td><button class="issue-title" data-issue="${i.id}">${esc(i.title)}</button><div class="issue-summary">${esc(i.summary)}</div></td><td class="number count">${i.people}</td><td class="number count">${i.accounts}</td><td class="org-label">${esc(shortMinistry(i.ministry))}<small>${esc(i.service)}</small></td><td class="evidence-cell"><button class="evidence-link" data-issue="${i.id}">View evidence</button><small>${i.sources} ${i.sources===1?'source page':'source pages'}</small></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No matching complaints. Try a broader search or reset the filters.</td></tr>';
  }
  function evidenceEntry(r){
    const label=r.authorType==='person'?'Named complainant':r.authorType==='account'?'Public account':'Unattributed';
    const sourceLabel = /political|partisan/i.test(r.sourceKind)?'Political release':r.sourceKind;
    return `<article class="evidence-entry"><div class="evidence-meta"><strong>${esc(r.authorId||r.id)}</strong>${esc(dateText(r))}${dateNote(r)?`<br><span>${esc(dateNote(r))}</span>`:''}<br><span class="source-tag">${label}${r.counted?'':' · not counted'}</span></div><div><h3>${esc(issueMap.get(r.issueId).title)}</h3><p>${esc(r.summary)}</p><p class="evidence-note">${esc(sourceLabel)}${r.publisher?' · '+esc(r.publisher):''}${r.region?' · '+esc(r.region):''}</p>${r.context?`<p class="evidence-note">${esc(r.context)}</p>`:''}${r.status?`<p class="evidence-note">${esc(r.status)}</p>`:''}</div><div>${link(r.url,'View source ↗','text-link')}${r.sourcePage&&r.sourcePage!==r.url?`<br>${link(r.sourcePage,'Full discussion','text-link')}`:''}<div class="evidence-meta">${esc(r.id)}</div></div></article>`;
  }
  function renderEvidence(){
    const records=[...current].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.id.localeCompare(b.id));
    $('evidence-count').textContent=`Showing ${Math.min(state.visible,records.length)} of ${records.length} evidence records. Stable IDs identify repeat sources; source links reveal the original attribution.`;
    $('evidence-list').innerHTML=records.slice(0,state.visible).map(evidenceEntry).join('')||'<p class="empty">No evidence matches the current filters.</p>';
    $('load-more').hidden=state.visible>=records.length;
  }
  function routeContent(route){
    if(!route)return '';
    return `<div class="route-steps"><div><span class="route-label">First contact</span><p>${esc(route.first)}</p></div><div><span class="route-label">Policy / further review</span><p>${esc(route.escalation)}</p></div></div><div class="route-links">${route.links.map(l=>link(l.url,l.title+' ↗')).join('')}</div>${route.note?`<p class="footnote">${esc(route.note)}</p>`:''}`;
  }
  function renderRoutes(){
    $('routing-list').innerHTML=data.routes.map(r=>`<article class="routing-row"><div><h3>${esc(r.title)}</h3><small>${esc(r.ministry)}</small></div><div>${routeContent(r)}</div></article>`).join('');
  }
  function render(){
    current=data.observations.filter(matches);
    const rows=issueRows(current);
    renderMetrics();renderChart(rows);renderRespond(rows);renderIssues(rows);renderEvidence();
  }
  function openIssue(id){
    const issue=issueMap.get(id), records=current.filter(r=>r.issueId===id), s=stats(records), route=routeMap.get(issue.routeId);
    $('dialog-content').innerHTML=`<h2 id="dialog-title">${esc(issue.title)}</h2><p>${esc(issue.summary)}</p><div class="dialog-counts"><div><strong>${s.people}</strong><span>Named complainants</span></div><div><strong>${s.accounts}</strong><span>Public accounts</span></div><div><strong>${s.sources}</strong><span>Source pages</span></div></div><p class="footnote">Filtered sample. People and accounts may overlap. Multiple voices can describe the same event.</p><h3 style="margin-top:24px">Responsible: ${esc(shortMinistry(issue.ministry))}</h3>${routeContent(route)}<h3 style="margin-top:26px">Evidence behind the count</h3>${records.map(evidenceEntry).join('')}`;
    $('issue-dialog').showModal();$('issue-dialog').scrollTop=0;
  }
  const csvCell=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
  function download(filename,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function csv(headers,rows){return '\ufeff'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')}
  function exportSummary(){const rows=issueRows(current);download('saskatchewan-complaint-issues.csv',csv(['Issue','Summary','Named complainants','Public accounts','Source pages','Ministry or oversight','Service provider','Complaint route','Source URLs'],rows.map(i=>[i.title,i.summary,i.people,i.accounts,i.sources,i.ministry,i.service,routeMap.get(i.routeId)?.first,unique(i.items.map(sourceUrl)).join(' | ')])),'text/csv;charset=utf-8')}
  function exportEvidence(){download('saskatchewan-complaint-evidence.csv',csv(['Record ID','Source identity','Identity type','Counted','Publication date','Date label','Date precision','Issue','Ministry','Summary','Source type','Publisher','Source URL','Discussion URL','Status','Context'],current.map(r=>[r.id,r.authorId,r.authorType,r.counted,r.date,r.dateLabel,r.datePrecision,issueMap.get(r.issueId).title,issueMap.get(r.issueId).ministry,r.summary,r.sourceKind,r.publisher,r.url,r.sourcePage,r.status,r.context])),'text/csv;charset=utf-8')}
  $('ministry').innerHTML+=[...new Set(data.issues.map(i=>i.ministry))].sort().map(m=>`<option value="${esc(m)}">${esc(shortMinistry(m))}</option>`).join('');
  $('search').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();state.visible=12;render()});
  [['ministry','ministry'],['source-type','source'],['period','period']].forEach(([id,key])=>$(id).addEventListener('change',e=>{state[key]=e.target.value;state.visible=12;render()}));
  $('chart-metric').addEventListener('change',e=>{state.metric=e.target.value;renderChart(issueRows(current))});
  $('reset').addEventListener('click',()=>{Object.assign(state,{search:'',ministry:'all',source:'all',period:'all',sort:'total',visible:12});$('search').value='';['ministry','source-type','period'].forEach(id=>$(id).value='all');render()});
  $('load-more').addEventListener('click',()=>{state.visible+=20;renderEvidence()});
  document.addEventListener('click',e=>{const issue=e.target.closest('[data-issue]');if(issue)openIssue(issue.dataset.issue);const sort=e.target.closest('[data-sort]');if(sort){state.sort=sort.dataset.sort;renderIssues(issueRows(current))}});
  $('close-dialog').addEventListener('click',()=>$('issue-dialog').close());
  $('issue-dialog').addEventListener('click',e=>{if(e.target===$('issue-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
  $('export-top').addEventListener('click',exportSummary);$('export-summary').addEventListener('click',exportSummary);$('export-evidence').addEventListener('click',exportEvidence);
  $('export-json').addEventListener('click',()=>download('saskatchewan-complaints-data.json',JSON.stringify(data,null,2),'application/json'));
  $('official-grid').innerHTML=data.official.map(o=>`<div class="official-item"><span>${esc(o.label)}</span><strong>${o.count}</strong></div>`).join('');
  $('coverage-notes').innerHTML='<ul>'+data.coverage.map(n=>`<li>${esc(n)}</li>`).join('')+'</ul>';
  document.querySelectorAll('.sidebar nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.sidebar nav a').forEach(n=>n.classList.toggle('active',n===a))}));
  renderRoutes();render();
})();
