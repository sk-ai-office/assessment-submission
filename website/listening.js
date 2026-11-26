(() => {
  'use strict';
  const data = window.LISTENING;
  const briefs = window.ComplaintBriefs;
  let activeBrief = null;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const unique = values => new Set(values).size;
  const link = (url, label) => /^https:\/\//.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : esc(label);
  const fitLabel = {assist:'AI could help',mixed:'AI + service change',service:'Service / policy fix'};
  const state = {query:'', ministry:'all', platform:'all', fit:'all', sort:'recommended', open:null, expanded:new Set(), libraryQuery:'', libraryLimit:12};
  const issues = new Map(data.issues.map(i => [i.id, i]));
  const routes = new Map(data.routes.map(r => [r.id, r]));
  const records = id => data.observations.filter(r => r.issueId === id);
  const counts = rows => ({accounts:unique(rows.filter(r => r.counted && r.authorType === 'account').map(r => r.authorId)), people:unique(rows.filter(r => r.counted && r.authorType === 'person').map(r => r.authorId)), uncounted:rows.filter(r => !r.counted && r.platform !== 'Reporting').length});
  const platformMatches = r => state.platform === 'all' || r.platform === (state.platform === 'reporting' ? 'Reporting' : state.platform);
  const filteredRecords = id => records(id).filter(platformMatches);
  const dateValue = r => r.date || '';
  const lower = value => String(value ?? '').toLowerCase();
  const roleLabel = r => ({firsthand:'Personal experience', household:'Household experience', advocate:'Policy / advocacy comment', 'professional opinion':'Professional opinion', 'reported experience':'Reported experience', 'secondhand':'Experience reported by someone else'}[r.sourceRole] || r.sourceRole || r.sourceKind);

  function dateText(r) {
    if (!r.date) return 'Date unverified · excluded from counts';
    if (/thread|discussion|parent/.test(r.datePrecision || '')) return `${r.date} · discussion date; comment day unverified`;
    return r.date;
  }
  function evidenceCard(r, detailed = false) {
    const social = r.platform !== 'Reporting';
    const author = social ? r.authorHandle || r.authorId : `${r.publisher} · person ${r.authorId}`;
    const sourceLabel = r.platform === 'App Store' ? 'Original review page' : r.platform === 'LinkedIn' ? 'Original discussion' : social ? 'Original post / comment' : 'Original report';
    const fallback = r.sourcePage && r.sourcePage !== r.url ? ` · ${link(r.sourcePage, 'Full discussion')}` : '';
    const context = [r.context, r.status].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(' ');
    return `<article class="evidence-card" data-evidence="${esc(r.id)}">
      <div class="evidence-type"><span class="reference">${esc(r.referenceId)}</span> · ${esc(roleLabel(r))}${!r.counted ? ' · not counted' : ''}</div>
      ${r.quote ? `<blockquote>${esc(r.quote)}</blockquote>` : `<p class="unquoted">${esc(r.summary)}</p>`}
      <div class="evidence-meta"><span class="evidence-handle">${esc(author)}</span> · ${esc(social ? r.platform : 'News & reports')}<br><span${!r.date ? ' class="date-warning"' : ''}>${esc(dateText(r))}</span> · ${link(r.url, sourceLabel)}${fallback}</div>
      ${social && r.summary ? `<p class="evidence-context">${esc(r.summary)}</p>` : ''}
      ${context ? `<p class="evidence-context">${esc(context)}</p>` : ''}
      ${detailed ? `<details><summary>Source and verification details</summary><p>Record ${esc(r.id)} · ${esc(r.sourceTitle)} · ${esc(r.region)}.</p><p>${esc(r.verification || 'Named testimony in reporting; the underlying service experience has not been independently verified.')}</p><p>Counted: ${r.counted ? (r.authorType === 'person' ? 'Named person in reporting, counted separately.' : 'Public account, once per issue.') : 'No.'} ${esc(r.exclusionReason || '')}</p></details>` : ''}
    </article>`;
  }
  function routeLinks(route) {
    return route ? `<div class="route-links">${route.links.map(l => link(l.url, l.title)).join('')}</div>` : '';
  }
  function owner(i) {
    return i.ministry.includes('Crown Investments') ? `${esc(i.service)}<small>Crown Investments Corporation oversight</small>` : `${esc(i.ministry)}<small>${esc(i.service)}</small>`;
  }
  function countCell(rows) {
    const c = counts(rows);
    const social = rows.filter(r => r.platform !== 'Reporting');
    const discussions = unique(social.filter(r => r.counted).map(r => r.sourcePage || r.url));
    if (c.accounts) return `<span class="row-count">${c.accounts}<small>${discussions} discussion${discussions === 1 ? '' : 's'}${c.people ? ` · ${c.people} named in reporting` : ''}${c.uncounted ? ` · ${c.uncounted} excluded` : ''}</small></span>`;
    return `<span class="row-count no-count">—<small>${c.people ? `Reporting only · ${c.people} named` : social.length ? `${social.length} comments; date unverified` : 'No countable accounts'}</small></span>`;
  }
  function issueDetail(i, rows) {
    const social = rows.filter(r => r.platform !== 'Reporting');
    const reporting = rows.filter(r => r.platform === 'Reporting');
    const all = state.expanded.has(i.id);
    const shown = all ? social : social.slice(0, 2);
    const route = routes.get(i.routeId);
    const heading = social.length ? 'What people are saying' : 'What people told reporters';
    const supporting = reporting.length ? `<${social.length ? 'details class="reported-details"' : 'div'}>${social.length ? `<summary>Supporting reporting · ${counts(reporting).people} named people</summary>` : '<p class="evidence-context">Direct social posts have not been verified for this issue. These accounts come from reporting.</p>'}${reporting.map(r => evidenceCard(r)).join('')}</${social.length ? 'details' : 'div'}>` : '';
    return `<div class="detail" id="detail-${esc(i.id)}"><div class="complaint-actions"><span><strong>${esc(i.referenceId)}</strong> · Internal complaint reference</span><button class="secondary" data-share="${esc(i.id)}">Share complaint ↗</button></div><section aria-label="Source evidence"><h3>${heading}</h3>${shown.map(r => evidenceCard(r)).join('')}${social.length > 2 ? `<button class="underlined" data-evidence-toggle="${esc(i.id)}">${all ? 'Show fewer excerpts' : `Show all ${social.length} social excerpts`}</button>` : ''}${supporting}</section>
    <section class="idea" aria-label="AI assessment"><span class="label">${esc(fitLabel[i.fit])}</span><h3>${i.fit === 'service' ? 'What should happen first' : 'Where AI could help'}</h3><p>${esc(i.idea)}</p><h3>What AI cannot fix</h3><p>${esc(i.limit)}</p><details><summary>First step, success measure & service owner</summary><h4>First step</h4><p>${esc(i.firstStep)}</p><h4>Measure success</h4><p>${esc(i.measure)}</p><h4>Service team and ministry</h4><p>${esc(route?.first || i.service)}</p><p>${esc(route?.escalation || i.ministry)}</p>${route?.note ? `<p>${esc(route.note)}</p>` : ''}${routeLinks(route)}<h4>Why this starting point</h4><p>${esc(i.reason)}</p></details></section></div>`;
  }
  function visibleIssues() {
    const query = lower(state.query.trim());
    return data.issues.filter(i => {
      if (state.ministry !== 'all' && i.ministry !== state.ministry) return false;
      if (state.fit === 'ai' && !['assist','mixed'].includes(i.fit)) return false;
      if (state.fit === 'service' && !['service','mixed'].includes(i.fit)) return false;
      const rows = filteredRecords(i.id);
      if (!rows.length) return false;
      return !query || lower([i.referenceId,i.id,i.concern,i.why,i.ministry,i.service,i.idea,i.limit,...rows.flatMap(r => [r.referenceId,r.id,r.summary,r.quote,r.authorHandle,r.publisher])].join(' ')).includes(query);
    }).sort((a,b) => {
      if (state.sort === 'accounts') return counts(filteredRecords(b.id)).accounts - counts(filteredRecords(a.id)).accounts || a.priority - b.priority;
      if (state.sort === 'recent') return filteredRecords(b.id).map(dateValue).sort().at(-1).localeCompare(filteredRecords(a.id).map(dateValue).sort().at(-1)) || a.priority - b.priority;
      return a.priority - b.priority;
    });
  }
  function renderIssues() {
    const visible = visibleIssues();
    const selectedRows = visible.flatMap(i => filteredRecords(i.id));
    const c = counts(selectedRows);
    $('result-note').textContent = `${visible.length} of ${data.issues.length} concerns · ${c.accounts} public accounts in this view · Open a concern for evidence and next steps`;
    if (!visible.length) {
      const gap = ['X','Quora'].includes(state.platform);
      $('issue-list').innerHTML = `<div class="empty-state"><h3>${gap ? 'A coverage gap, not zero complaints' : 'No concerns match these filters'}</h3><p>${state.platform === 'X' ? 'No attributable, dated X posts could be directly verified in this review. Other platforms provide evidence in the main list.' : state.platform === 'Quora' ? 'Quora pages could not be reviewed because access was blocked. No Quora accounts are counted.' : 'Try a broader search, a different ministry, or all evidence.'}</p><button class="secondary" id="clear-filters">Show all concerns</button></div>`;
      $('clear-filters').onclick = clearFilters;
      return;
    }
    $('issue-list').innerHTML = visible.map(i => {
      const rows = filteredRecords(i.id);
      const open = state.open === i.id;
      return `<article class="issue" id="issue-${esc(i.id)}"><button class="issue-toggle" data-issue="${esc(i.id)}" aria-expanded="${open}" aria-controls="detail-${esc(i.id)}"><span><span class="issue-title">${esc(i.concern)}</span><span class="issue-why">${esc(i.why)}</span></span>${countCell(rows)}<span class="row-owner">${owner(i)}</span><span class="row-fit"><span class="fit-label ${i.fit}">${esc(fitLabel[i.fit])}</span></span></button>${open ? issueDetail(i,rows) : `<div id="detail-${esc(i.id)}" hidden></div>`}</article>`;
    }).join('');
    $('issue-list').querySelectorAll('[data-issue]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.issue;
      state.open = state.open === id ? null : id;
      try { history.replaceState(null,'',state.open ? '#'+issues.get(id).referenceId : location.href.split('#')[0]); } catch { /* Some local-file viewers restrict history updates. */ }
      renderIssues();
      const replacement = document.querySelector(`[data-issue="${id}"]`);
      replacement.focus({preventScroll:true});
      if (replacement.getBoundingClientRect().top < 0) replacement.scrollIntoView({block:'start',behavior:'instant'});
    }));
    $('issue-list').querySelectorAll('[data-share]').forEach(button => button.addEventListener('click',()=>openShare(button.dataset.share)));
    $('issue-list').querySelectorAll('[data-evidence-toggle]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.evidenceToggle;
      state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
      const y = button.getBoundingClientRect().top;
      renderIssues();
      const replacement = document.querySelector(`[data-evidence-toggle="${id}"]`);
      replacement.focus({preventScroll:true});
      if (!state.expanded.has(id)) window.scrollBy(0, replacement.getBoundingClientRect().top-y);
    }));
  }
  function clearFilters() {
    Object.assign(state,{query:'',ministry:'all',platform:'all',fit:'all'});
    $('search').value = ''; $('ministry').value = 'all'; $('platform').value = 'all';
    updateChips(); renderIssues();
  }
  function updateChips() {
    document.querySelectorAll('[data-fit]').forEach(b => {const active = b.dataset.fit === state.fit; b.classList.toggle('selected',active); b.setAttribute('aria-pressed',String(active));});
  }
  function renderLibrary() {
    const query = lower(state.libraryQuery.trim());
    const rows = data.observations.filter(r => !query || lower([r.referenceId,r.complaintReferenceId,r.id,r.authorHandle,r.publisher,r.platform,r.quote,r.summary,r.sourceTitle,issues.get(r.issueId)?.concern,issues.get(r.issueId)?.ministry].join(' ')).includes(query));
    $('library-count').textContent = `${rows.length} matching records of ${data.observations.length} · source excerpts, context, and original links`;
    $('library').innerHTML = rows.slice(0,state.libraryLimit).map(r => `<div class="library-item"><div><h3>${esc(issues.get(r.issueId)?.concern)}</h3><span class="source-id">${esc(r.complaintReferenceId)} · Original record ${esc(r.id)} · ${esc(issues.get(r.issueId)?.ministry)}</span></div>${evidenceCard(r,true)}</div>`).join('') || '<p class="small-note">No evidence matches your search.</p>';
    $('more-library').hidden = rows.length <= state.libraryLimit;
    $('more-library').textContent = `Show ${Math.min(12,rows.length-state.libraryLimit)} more records`;
  }
  function showView(research) {
    $('concerns-view').hidden = research;
    $('research-view').hidden = !research;
    for (const [id,active] of [['tab-concerns',!research],['tab-research',research]]) {$(id).classList.toggle('active',active);$(id).setAttribute('aria-selected',String(active));$(id).tabIndex = active ? 0 : -1;}
  }
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content],{type}));
    const a = document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function csv(rows, fields) {
    const quote = val => {let value = String(val ?? '');if (/^[=+\-@\t\r]/.test(value)) value = "'"+value;return '"'+value.replace(/"/g,'""')+'"';};
    return '\uFEFF'+[fields,...rows.map(row=>fields.map(field=>row[field]))].map(row=>row.map(quote).join(',')).join('\r\n');
  }
  function exportEvidence() {
    download('saskatchewan-complaint-evidence.csv',csv(data.observations,['referenceId','complaintReferenceId','id','issueId','platform','authorId','authorHandle','authorType','sourceRole','counted','date','dateLabel','datePrecision','quote','summary','url','sourcePage','sourceTitle','publisher','status','context','verification']),'text/csv;charset=utf-8');
  }
  function exportIssues() {
    const rows = [...data.issues].sort((a,b)=>a.priority-b.priority).map(i=>{const all=records(i.id),c=counts(all);return {...i,public_accounts:c.accounts,named_in_reporting:c.people,uncounted_social_records:c.uncounted,fit:fitLabel[i.fit],source_urls:[...new Set(all.map(r=>r.url))].join(' | ')};});
    download('saskatchewan-complaint-issues.csv',csv(rows,['referenceId','id','concern','why','public_accounts','named_in_reporting','uncounted_social_records','ministry','service','fit','idea','limit','firstStep','measure','reason','source_urls']),'text/csv;charset=utf-8');
  }

  function openShare(id) {
    activeBrief = briefs.pack(data,id);
    $('share-title').textContent = activeBrief.issue.concern;
    $('share-reference').textContent = activeBrief.referenceId;
    $('share-scope').textContent = `${activeBrief.counts.evidenceRecords} evidence records · Complete context included`;
    const shareUrl = publicLink(activeBrief.referenceId);
    $('share-link').value=shareUrl || '';
    $('share-link').placeholder='Available after publication';
    $('copy-link').disabled=!shareUrl;
    $('link-access-note').textContent=shareUrl ? 'Anyone with this link can view the complete complaint brief.' : 'The public link will be available when this version is published.';
    $('download-format').value='pdf';
    $('share-status').textContent='';$('manual-copy').hidden=true;$('share-copy-text').value='';
    $('share-dialog').showModal();
  }
  function publicLink(referenceId) {
    const config=window.SHARING_CONFIG || {};
    const hosted=location.protocol==='https:' && !['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    const base=hosted ? location.origin : config.published ? config.publicBaseUrl : '';
    return base ? base.replace(/\/$/,'')+'/complaint-briefs/'+encodeURIComponent(referenceId)+'.html' : '';
  }
  function downloadSelectedBrief() {
    const format=$('download-format').value;
    if(format==='pdf') {
      const encoded=window.COMPLAINT_PDFS?.[activeBrief.referenceId];
      if(!encoded){$('share-status').textContent='The PDF is unavailable in this copy. Download the HTML or text version.';return;}
      download(activeBrief.referenceId+'.pdf',Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),'application/pdf');
    } else if(format==='html') {
      download(activeBrief.referenceId+'.html',briefs.html(activeBrief,window.COMPLAINT_PDFS?.[activeBrief.referenceId]),'text/html;charset=utf-8');
    } else download(activeBrief.referenceId+'.txt',briefs.text(activeBrief),'text/plain;charset=utf-8');
    $('share-status').textContent=`${format.toUpperCase()} download prepared with all evidence and context.`;
  }
  async function copyShare(value, confirmation) {
    const previousFocus=document.activeElement;
    const field=$('share-copy-text');
    field.value=value;$('manual-copy').hidden=false;field.focus();field.select();
    let copied=false;
    try { copied=document.execCommand('copy'); } catch { /* Fall back to the Clipboard API. */ }
    if(copied){$('share-status').textContent=confirmation;$('manual-copy').hidden=true;previousFocus?.focus({preventScroll:true});return;}
    $('manual-copy').hidden=true;$('share-status').textContent='Copying…';
    previousFocus?.focus({preventScroll:true});
    let timeout;
    try {
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await Promise.race([navigator.clipboard.writeText(value),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Clipboard unavailable')),2500);})]);
      $('share-status').textContent=confirmation;$('manual-copy').hidden=true;
    } catch {
      $('share-status').textContent='Select and copy the text below. Automatic copying is unavailable in this browser.';
      $('manual-copy').hidden=false;$('share-copy-text').value=value;$('share-copy-text').focus();$('share-copy-text').select();
    } finally { clearTimeout(timeout); }
  }
  function followReference() {
    const ref=location.hash.slice(1).toUpperCase();
    const evidence=data.observations.find(r=>r.referenceId===ref);
    const issue=data.issues.find(i=>i.referenceId===ref||(evidence&&i.id===evidence.issueId));
    if(!issue)return;
    Object.assign(state,{query:'',ministry:'all',platform:'all',fit:'all',open:issue.id});
    if(evidence)state.expanded.add(issue.id);
    $('search').value='';$('ministry').value='all';$('platform').value='all';
    updateChips();showView(false);renderIssues();
    if(evidence&&evidence.platform==='Reporting'){
      const supporting=document.querySelector(`#detail-${issue.id} .reported-details`);if(supporting)supporting.open=true;
    }
    const target=evidence?document.querySelector(`#detail-${issue.id} [data-evidence="${evidence.id}"]`):$('issue-'+issue.id);
    if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
  }

  const overall = counts(data.observations);
  $('snapshot').innerHTML = `<span><strong>${data.issues.length}</strong> concerns tracked</span><span><strong>${overall.accounts}</strong> public accounts counted</span><span>25 Nov 2024 – 25 Nov 2026</span>`;
  $('ministry').insertAdjacentHTML('beforeend',[...new Set(data.issues.map(i=>i.ministry))].sort().map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join(''));
  $('platform-coverage').innerHTML = data.platformCoverage.map(p=>`<div class="coverage-row"><strong>${esc(p.platform)}</strong><span>${esc(p.note)}</span></div>`).join('');
  $('research-routes').innerHTML = data.routes.map(r=>`<div class="route-research"><h4>${esc(r.title)} · ${esc(r.ministry)}</h4><p>${esc(r.first)}</p><p>${esc(r.escalation)}</p><p>${esc(r.note)}</p>${routeLinks(r)}</div>`).join('');
  $('official-context').innerHTML = `<div class="official-grid">${data.official.map(r=>`<div class="official-row"><span>${esc(r.label)}</span><strong>${r.count.toLocaleString()}</strong></div>`).join('')}</div>`;
  $('coverage-notes').innerHTML = data.coverage.map(note=>`<p>${esc(note)}</p>`).join('')+`<p>${esc(data.scopeNote)}</p><p>The suggested order reflects possible investigation starting points, not a ranking of harm or province-wide prevalence. Full search notes and the original dataset are included in the research download.</p>`;
  $('search').addEventListener('input',e=>{state.query=e.target.value;renderIssues();});
  for (const id of ['ministry','platform','sort']) $(id).addEventListener('change',e=>{state[id]=e.target.value;renderIssues();});
  document.querySelectorAll('[data-fit]').forEach(button=>button.addEventListener('click',()=>{state.fit=button.dataset.fit;updateChips();renderIssues();}));
  $('tab-concerns').onclick = ()=>showView(false);$('tab-research').onclick = ()=>showView(true);
  for (const id of ['tab-concerns','tab-research']) $(id).addEventListener('keydown',e=>{if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {e.preventDefault();const research = e.key === 'End' || (e.key !== 'Home' && id === 'tab-concerns');showView(research);$(research?'tab-research':'tab-concerns').focus();}});
  $('evidence-search').addEventListener('input',e=>{state.libraryQuery=e.target.value;state.libraryLimit=12;renderLibrary();});
  $('more-library').onclick = ()=>{state.libraryLimit+=12;renderLibrary();};
  $('export').onclick = ()=>$('export-dialog').showModal();
  $('close-export').onclick = ()=>$('export-dialog').close();
  $('export-dialog').addEventListener('click',e=>{if(e.target===$('export-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('export-issues').onclick = exportIssues;
  $('export-evidence').onclick = exportEvidence;
  $('export-all-evidence').onclick = exportEvidence;
  $('close-share').onclick = ()=>$('share-dialog').close();
  $('download-brief').onclick = downloadSelectedBrief;
  $('copy-link').onclick = ()=>copyShare($('share-link').value,'Link copied. Anyone with the link can open this complaint brief.');
  $('copy-brief').onclick = ()=>copyShare(briefs.text(activeBrief),'Complete brief copied, including all evidence and context.');
  $('copy-reference').onclick = ()=>copyShare(activeBrief.referenceId,'Reference ID copied: '+activeBrief.referenceId);
  $('download-data').onclick = ()=>download('saskatchewan-complaints-data.json',JSON.stringify(data,null,2),'application/json');
  $('download-original').onclick = ()=>download('saskatchewan-original-research.json',JSON.stringify(data.originalResearch,null,2),'application/json');
  window.addEventListener('hashchange',followReference);
  showView(false);renderIssues();renderLibrary();followReference();
})();
