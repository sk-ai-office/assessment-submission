(() => {
  'use strict';
  const seed = JSON.parse(document.getElementById('seed').textContent);
  const staff = document.body.dataset.role === 'ministry';
  const actor = staff ? 'Ministry' : 'Applicant';
  const storageKey = 'sk-childcare-applications-v1';
  const $ = s => document.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let storageError = '', saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { storageError = 'Saved data could not be read. Export your work before closing this page.'; }
  let model;
  try { model = new ProviderModel(seed, saved); } catch { model = new ProviderModel(seed); storageError = 'The saved record could not be loaded. Sample cases are shown; your stored copy has not been overwritten.'; }
  let selectedId = seed.meta.primaryCaseId, tab = 'overview', queue = false, profileDirty = false;
  try { selectedId = localStorage.getItem(storageKey+'-selected-'+actor) || selectedId; } catch {}
  let query = '', typeFilter = '', stageFilter = '', modalSubmit = null, lastFocus = null, newType = 'family_home', newDraft = {};
  const labels = {missing:'Not provided',received:'Awaiting review',accepted:'Accepted',needs_changes:'Needs changes',proceed:'Proceed',under_review:'Under review',not_decided:'Not decided',approved:'Approved',declined:'Declined',not_requested:'Not requested',hold:'On hold',paused:'On hold',not_submitted:'Not submitted',draft:'Draft',not_started:'Not started',awaiting_review:'Awaiting review',in_progress:'In progress',complete:'Complete'};
  const routeDescriptions = {
    family_home:'Child care in a residential home, for up to 8 attending children within the applicable age limits.',
    group_home:'Child care in a residential home, for up to 16 attending children. An adult assistant is required above 8.',
    centre:'A centre operation with its own premises, staffing and governance requirements, including small centres.'
  };
  const stageName = id => seed.workflow.stages.find(s => s.id === id)?.title || id;
  const typeName = id => model.type(id)?.title || id;
  const fmtDate = d => d ? new Intl.DateTimeFormat('en-CA',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Regina'}).format(new Date(d.length === 10 ? d+'T12:00:00Z' : d)) : '—';
  const btn = (label, action, data='', kind='') => `<button type="button" class="btn ${kind}" data-action="${action}" ${data}>${label}</button>`;
  const info = (topic, title) => `<button type="button" class="icon-btn info-inline" data-action="info" data-topic="${topic}" aria-label="${esc(title)}" title="${esc(title)}">i</button>`;
  const badge = (status, custom) => `<span class="badge ${['needs_changes','received','hold'].includes(status)?'warning':['accepted','approved','proceed','complete'].includes(status)?'success':'neutral'}">${esc(custom || labels[status] || status)}</span>`;
  const current = () => model.state.cases.find(c => c.id === selectedId) || model.state.cases[0];
  const userDocs = c => c.documents.filter(d => !['licence_decision','funding_decision'].includes(d.documentTypeId));
  function nextTask(c) {
    const docs = userDocs(c);
    if (staff && c.status === 'draft') return {title:'The applicant is completing their application',detail:'Review the shared details as they are prepared.',action:'application',button:'View application'};
    if (staff) {
      const ready = [...docs].sort((a,b)=>(a.documentTypeId==='banking_setup'?1:0)-(b.documentTypeId==='banking_setup'?1:0)).find(d => d.status === 'received');
      if (ready) return {title:`Review ${model.docType(ready.documentTypeId).title.toLowerCase()}`,detail:ready.note,doc:ready.documentTypeId,action:'review',button:'Review record'};
      const correction = docs.find(d => d.status === 'needs_changes');
      if (correction) return {title:'Waiting for the applicant’s update',detail:correction.note,doc:correction.documentTypeId,action:'review',button:'View request'};
      const visit = docs.find(d => d.owner === 'Ministry' && d.status !== 'accepted' && model.docType(d.documentTypeId).stageId === c.currentStageId);
      if (visit) return {title:model.docType(visit.documentTypeId).title,detail:visit.note,doc:visit.documentTypeId,action:'review',button:'Record review'};
      if(docs.some(d=>d.status==='missing'&&model.docType(d.documentTypeId).stageId===c.currentStageId)) return {title:'Waiting for supporting records',detail:'The outstanding requirements are listed in the application.',action:'documents',button:'View requirements'};
      return {title:'Review the application’s next stage',detail:'Check the outstanding requirements and record your decision.',action:'stage',button:'Review stage'};
    }
    const correction = docs.find(d => d.status === 'needs_changes');
    if (correction) return {title:correction.note || `Update ${model.docType(correction.documentTypeId).title.toLowerCase()}.`,doc:correction.documentTypeId,action:'evidence',button:'Add updated document'};
    const missing = docs.find(d => d.status === 'missing' && d.owner === 'Applicant');
    if (missing) return {title:`Complete your ${model.docType(missing.documentTypeId).title.toLowerCase()}`,detail:missing.note,doc:missing.documentTypeId,action:'evidence',button:'Continue application'};
    if (c.decisions.licence.status === 'approved') return {title:'Your licensing review is complete',detail:'View the recorded outcome and any separate funding decision.',action:'decisions',button:'View decisions'};
    return {title:'Your application is with the review team',detail:'We’ll show the next requested update here.',action:'documents',button:'View documents'};
  }
  function persist(message='Changes saved') {
    try { localStorage.setItem(storageKey, JSON.stringify(model.state)); storageError = ''; }
    catch { storageError = 'This browser could not save your changes. Export the case to keep a copy.'; }
    render(); toast(storageError || message);
  }
  function toast(message) { const t=$('#toast');t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,5500); }
  function render() {
    if (!model.state.cases.some(c => c.id === selectedId) && model.state.cases[0]) selectedId=model.state.cases[0].id;
    try { localStorage.setItem(storageKey+'-selected-'+actor,selectedId); } catch {}
    $('#header-actions').innerHTML = staff ? `${btn('Import case','import')}${info('about','About this dashboard')}` : `${btn('New application','new','','primary')}${info('about','About this dashboard')}`;
    $('#storage-error').innerHTML = storageError ? `<div class="notice warning">${esc(storageError)}</div>` : '';
    $('#main').innerHTML = queue ? queueView() : detailView(current());
  }
  function queueView() {
    const cases=model.state.cases.filter(c=>(!typeFilter||c.facilityTypeId===typeFilter)&&(!stageFilter||c.currentStageId===stageFilter)&&(`${c.facilityName} ${c.applicationNumber||c.id} ${c.city}`.toLowerCase().includes(query.toLowerCase())));
    return `<div class="page-heading"><div><h1>${staff?'Applications to review':'Your applications'}</h1><p class="subline" id="result-count">${cases.length} ${cases.length===1?'application':'applications'}</p></div>${staff?'':btn('Import case','import')}</div>
      <div class="filters"><label class="field"><span class="visually-hidden">Search applications</span><input id="search" type="search" placeholder="Search applications" value="${esc(query)}"></label><label class="field"><span class="visually-hidden">Provider type</span><select id="type-filter"><option value="">All provider types</option>${seed.facilityTypes.map(t=>`<option value="${t.id}" ${typeFilter===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select></label><label class="field"><span class="visually-hidden">Application stage</span><select id="stage-filter"><option value="">All stages</option>${seed.workflow.stages.map(s=>`<option value="${s.id}" ${stageFilter===s.id?'selected':''}>${s.title}</option>`).join('')}</select></label></div>
      <div class="table-wrap"><table class="queue"><thead><tr><th scope="col">Application</th><th scope="col">Stage</th><th scope="col">Next action</th><th scope="col">Updated</th><th scope="col"><span class="visually-hidden">Open</span></th></tr></thead><tbody>${cases.map(c=>`<tr><td><button class="text-btn case-link" data-action="open" data-id="${esc(c.id)}">${esc(c.facilityName)}</button><div class="small-text muted">${esc(c.applicationNumber||c.id)}<br>${esc(typeName(c.facilityTypeId))} · ${esc(c.city)}</div></td><td>${stageName(c.currentStageId)}</td><td class="queue-next">${esc(nextTask(c).title)}</td><td>${fmtDate(c.updatedAt)}</td><td><button class="icon-btn" aria-label="Open ${esc(c.facilityName)}" data-action="open" data-id="${esc(c.id)}">→</button></td></tr>`).join('')}</tbody></table></div>${cases.length?'':'<p class="empty-state">No applications match these filters.</p>'}`;
  }
  function detailView(c) {
    if (!c) return `<h1>No applications yet</h1>${btn('New application','new','','primary')}`;
    const next=nextTask(c);
    const stageIndex=seed.workflow.stages.findIndex(s=>s.id===c.currentStageId);
    return `<button class="back-link" data-action="queue">← All applications</button>
      <div class="page-heading"><div><h1 tabindex="-1">${esc(c.facilityName)}</h1><p class="subline">${esc(typeName(c.facilityTypeId))} · ${esc(c.city)} · ${esc(c.applicationNumber||c.id)} ${info('route','About this application type')}</p></div>${btn('Export case','export')}</div>
      <ol class="progress" aria-label="Application progress">${seed.workflow.stages.map((s,i)=>`<li class="step ${c.stages.find(x=>x.stageId===s.id)?.status==='complete'?'complete':i===stageIndex?'active':''}" ${i===stageIndex?'aria-current="step"':''}><span class="step-dot">${c.stages.find(x=>x.stageId===s.id)?.status==='complete'?'✓':i+1}</span><span>${s.title}</span></li>`).join('')}</ol>
      <div class="next-action"><div class="next-copy"><p class="eyebrow">${staff?'Next review':'Your next step'}</p><h2>${esc(next.title)}</h2>${next.detail&&staff?`<p>${esc(next.detail)}</p>`:''}</div>${btn(next.button,next.action,next.doc?`data-doc="${next.doc}"`:'','primary')}</div>
      <nav class="tabs" aria-label="Application sections">${[['overview','Overview'],['application','Provider details'],['documents','Documents'],['activity','Activity']].map(([id,title])=>`<button data-action="tab" data-tab="${id}" class="${tab===id?'active':''}" ${tab===id?'aria-current="page"':''}>${title}${id==='documents'&&c.documents.some(d=>d.status==='needs_changes')?'<span class="tab-dot" aria-label="Updates needed"></span>':''}</button>`).join('')}</nav>
      ${tab==='overview'?overview(c):tab==='application'?application(c):tab==='documents'?documents(c):activity(c)}`;
  }
  function overview(c) {
    let taskDocs = userDocs(c).filter(d=>d.status!=='accepted'&&!['banking_setup'].includes(d.documentTypeId));
    taskDocs.sort((a,b)=>({needs_changes:0,received:1,missing:2}[a.status]-{needs_changes:0,received:1,missing:2}[b.status]));
    const latest=c.history[c.history.length-1];
    const appt=(c.appointments||[]).find(a=>a.status==='scheduled');
    return `<div class="detail-grid"><section class="main-column"><div class="section-heading"><h2>What needs to happen</h2>${info('status','What the statuses mean')}</div>
      ${taskDocs.slice(0,4).map(d=>`<div class="task-row"><div class="task-copy"><button class="text-btn" data-action="${staff?'review':d.owner==='Ministry'?'inspect':'evidence'}" data-doc="${d.documentTypeId}">${esc(model.docType(d.documentTypeId).title)}</button><div class="small-text muted">${esc(d.documentTypeId==='home_space'&&appt?`${appt.title} · ${fmtDate(appt.date)}`:d.note)}</div></div><div class="task-state">${badge(d.status,d.documentTypeId==='home_space'&&appt?'Scheduled':null)}<small>${d.status==='received'||d.owner==='Ministry'?'Ministry':staff?'Applicant':'You'}</small></div></div>`).join('') || '<p class="notice">All supporting records have been reviewed.</p>'}
      <div class="inline-actions">${btn('View all requirements','documents','','small')}${staff?btn('Review stage','stage','','small'):c.status==='draft'?btn('Review & submit','submit','','small'):''}</div>
      <section class="latest-update"><h2>Latest update</h2>${latest?`<p class="small-text muted">${fmtDate(latest.at||latest.date)} · ${esc(latest.actor)}</p><h3>${esc(latest.title)}</h3><p>${esc(latest.detail)}</p>`:'<p>Your application has been started.</p>'}</section></section>
      <aside class="side-column"><h2>${staff?'Application contact':'Your application team'}</h2><p class="team-name">${staff?esc(c.profile.contactName||'Applicant'):'Early Years · '+esc(c.region||'Regional team')}</p><p class="small-text muted">${staff?esc(c.profile.email||'Contact details not provided'):'Case coordinator'}</p>${staff?'':`<p>${esc(c.coordinator||'To be assigned')}</p>`}${btn(staff?'Add case note':'Send a message','message')}
      <div class="section-heading decisions-heading"><h2>Decisions</h2>${info('decisions','About decisions')}</div><dl class="decision-list">${['readiness','licence','funding'].map(k=>`<div class="decision-row"><dt>${k==='readiness'?'Readiness':k==='licence'?'Operating licence':'Funding'}</dt><dd>${badge(c.decisions[k].status)}</dd></div>`).join('')}</dl>${staff?btn('Record a decision','decisions','','small'):btn('View details','decisions','','small')}</aside></div>`;
  }
  function field(label,name,value='',type='text',extra='') {return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;}
  const organizationOptions = [['nonprofit','Non-profit corporation'],['cooperative','Co-operative'],['municipality','Municipality'],['for_profit','For-profit corporation'],['individual','Individual'],['partnership','Partnership']];
  function selectField(label,name,options,value,extra='') { return `<label class="field"><span>${label}</span><select name="${name}" ${extra}>${options.map(([v,t])=>`<option value="${v}" ${value===v?'selected':''}>${t}</option>`).join('')}</select></label>`; }
  function profileFields(c,creating=false) {
    const p=c.profile||{}, fundingEligible=!['for_profit','individual','partnership'].includes(p.organizationType), disabled=staff&&!creating?'disabled':'', max=c.facilityTypeId==='centre'?90:c.facilityTypeId==='group_home'?16:8;
    return `<div class="form-grid">${field('Facility name','facilityName',c.facilityName||'','text',`required maxlength="100" ${disabled}`)}${field('Community','city',p.city||c.city||'','text',`required maxlength="100" ${disabled}`)}${field('Applicant name','contactName',p.contactName||'','text',`required maxlength="100" ${disabled}`)}${field('Email','email',p.email||'','email',`required maxlength="150" ${disabled}`)}${field('Street address','address',p.address||'','text',`maxlength="180" ${creating?'':'required'} ${disabled}`)}${field('Proposed spaces','capacity',p.capacity||'','number',`required min="1" max="${max}" ${disabled}`)}${field('Target opening date','openingDate',p.openingDate||'','date',disabled)}${selectField('Premises', 'premisesTenure',[['owned','Owned'],['rented','Rented']],p.premisesTenure||'owned',disabled)}${c.facilityTypeId==='centre'?selectField('Applicant structure','organizationType',organizationOptions,p.organizationType||'nonprofit',disabled):field('Adults living in the home','householdAdults',p.householdAdults||1,'number',`min="0" max="30" ${disabled}`)}${c.facilityTypeId==='centre'?selectField('Application pathway','pathway',fundingEligible?[['centre-development','Development & funding consideration'],['licensing-only','Operating licence only']]:[['licensing-only','Operating licence only']],c.pathway||'centre-development',disabled):''}<label class="field"><span>Information session</span><select name="informationSession" ${disabled}><option value="false" ${!p.informationSession?'selected':''}>Not completed</option><option value="true" ${p.informationSession?'selected':''}>Completed</option></select></label></div>`;
  }
  function application(c) {
    return `<section class="application-section"><div class="section-heading"><h2>Application details</h2>${info('reuse','How these details are used')}</div><form id="profile-form">${profileFields(c)}${staff?'':`<div class="form-actions"><button class="btn primary" type="submit">Save details</button>${c.status==='draft'?btn('Review & submit','submit'):''}</div>`}<p class="error-message" id="profile-error" role="alert"></p></form></section>`;
  }
  function documents(c) {
    return `<div class="section-heading"><h2>Required records</h2>${info('documents','About documents and original checks')}</div>${seed.workflow.stages.map(s=>{
      const docs=userDocs(c).filter(d=>model.docType(d.documentTypeId).stageId===s.id);
      return docs.length?`<section class="doc-group"><h3>${s.title}</h3>${docs.map(d=>{const def=model.docType(d.documentTypeId);return `<div class="doc-row"><div><strong>${esc(def.title)}</strong><p class="doc-note">${esc(d.note||def.requirement||'')}</p>${d.sampleFileName?`<span class="small-text muted">${esc(d.sampleFileName)}</span>`:''}</div>${badge(d.status)}<div class="inline-actions">${info(`document:${def.id}`,`Requirements for ${def.title}`)}${staff?btn(d.status==='accepted'?'View review':'Review','review',`data-doc="${def.id}"`,'small'):btn(d.status==='accepted'?'View':def.owner==='Ministry'?'View':d.status==='received'?'View / replace':d.status==='needs_changes'?'Update':'Add record',d.status==='accepted'||def.owner==='Ministry'?'inspect':'evidence',`data-doc="${def.id}"`,'small')}</div></div>`}).join('')}</section>`:'';
    }).join('')}`;
  }
  function activity(c) {
    const entries=[...c.history.filter(h=>h.title!=='Message added').map(h=>({...h,kind:'history'})),...(c.messages||[]).map(m=>({date:m.date,at:m.at,actor:m.author,title:'Message',detail:m.text,kind:'message'}))].sort((a,b)=>String(b.at||b.date).localeCompare(String(a.at||a.date)));
    return `<div class="section-heading"><h2>Activity & messages</h2>${btn(staff?'Add case note':'Send a message','message')}</div>${entries.map(h=>`<article class="activity-item"><p class="small-text muted">${fmtDate(h.at||h.date)} · ${esc(h.actor)}</p><h3>${esc(h.title)}</h3><p>${esc(h.detail)}</p></article>`).join('')||'<p class="empty-state">No updates yet.</p>'}`;
  }
  function openModal(title,body,submit=null,submitLabel='Save',wide=false) {
    lastFocus=document.activeElement; modalSubmit=submit;
    const dialog=$('#modal');dialog.className='modal'+(wide?' modal-wide':'');
    dialog.innerHTML=`<form id="modal-form"><div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-btn" type="button" data-action="close" aria-label="Close dialog">×</button></div><div class="modal-body">${body}<p class="error-message" id="modal-error" role="alert"></p></div><div class="modal-footer">${btn(submit?'Cancel':'Close','close')}${submit?`<button class="btn primary" type="submit">${submitLabel}</button>`:''}</div></form>`;
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('input,select,textarea,button')?.focus();
  }
  function closeModal() {$('#modal').close();modalSubmit=null;lastFocus?.focus();}
  function dataFrom(form) {const d=Object.fromEntries(new FormData(form));if('capacity'in d)d.capacity=Number(d.capacity);if('householdAdults'in d)d.householdAdults=Number(d.householdAdults);if('informationSession'in d)d.informationSession=d.informationSession==='true';return d;}
  function chooseType() {
    openModal('Start a child care application',`<p>Choose the setting you plan to operate.</p><div class="route-options">${seed.facilityTypes.map(t=>`<label class="route-option"><input type="radio" name="facilityTypeId" value="${t.id}" ${newType===t.id?'checked':''}><span><strong>${esc(t.title)}</strong><span class="small-text">${esc(routeDescriptions[t.id])}</span></span></label>`).join('')}</div><div class="inline-actions">${btn('Compare the application types','compare','','small')}</div>`,d=>{newType=d.facilityTypeId;createDetails();},'Continue');
  }
  function createDetails() {
    const temp={facilityTypeId:newType,facilityName:newDraft.facilityName||'',profile:newDraft};
    openModal(`New ${typeName(newType).toLowerCase()}`,`${profileFields(temp,true)}<details class="help-section"><summary>Which application will I complete?</summary><p>${esc(model.type(newType).currentProcedure)}</p><p>${esc(model.type(newType).eligibilityNote||'')}</p><p>${esc(model.type(newType).capacityNote)}</p></details><p class="small-text muted">This creates a sample application saved on this device.</p>`,d=>{const c=model.create({...d,facilityTypeId:newType,pathway:newType==='centre'?(d.pathway||'centre-development'):'home-licensing'});selectedId=c.id;queue=false;tab='application';newDraft={};closeModal();persist('Application created');},'Create application');
  }
  function evidenceModal(docId) {
    const c=current(),d=c.documents.find(x=>x.documentTypeId===docId),def=model.docType(docId);
    if(!d)return;
    if(def.owner==='Ministry'||d.status==='accepted')return inspectModal(docId);
    const physical=def.handling==='sealed_original',restricted=def.handling==='restricted_record';
    openModal(physical?'Record delivery of original checks':restricted?'Record completion':`Add ${d.sampleFileName?'updated ':''}sample evidence`, `<h3>${esc(def.title)}</h3>${d.status==='needs_changes'?`<div class="notice warning">${esc(d.note)}</div>`:''}<p>${physical?'The published process requires sealed original checks. This records delivery only; Ministry verification is a separate step.':restricted?'Record that the requirement has been addressed. Do not enter personal, reference or banking details.':'This demonstration attaches a sample record. Actual document storage would be connected in the live service.'}</p>${physical||restricted?'':field('Sample document name','fileName',`${docId.replaceAll('_','-')}-updated-demo.pdf`,'text','required maxlength="120"')}<label class="field"><span>${physical?'Delivery note':'Note for the reviewer'}</span><textarea name="note" rows="3" maxlength="1200" required>${esc(physical?'Sealed originals sent for verification.':d.status==='needs_changes'?'Updated sample record addresses the requested change.':'Sample evidence provided for review.')}</textarea></label>`,values=>{model.addEvidence(c.id,docId,{...values,sample:true});closeModal();persist(physical?'Delivery recorded; verification pending':'Sample record added for review');},physical?'Record as sent':'Add sample record');
  }
  function inspectModal(docId) {
    const d=current().documents.find(x=>x.documentTypeId===docId),def=model.docType(docId);
    openModal(esc(def.title),`${badge(d.status)}<p>${esc(d.note||def.requirement)}</p>${d.sampleFileName?`<p class="small-text">Sample record: ${esc(d.sampleFileName)}</p>`:''}${d.originalDeliveryStatus?`<p>Original delivery: ${esc(d.originalDeliveryStatus.replaceAll('_',' '))}</p>`:''}${(d.evidenceVersions||[]).length?`<h3>Record history</h3>${d.evidenceVersions.map(v=>`<p class="small-text">${esc(v.fileName||v.sampleFileName||'Record updated')} · ${esc(v.note||'')}</p>`).join('')}` : ''}${!staff&&d.owner!=='Ministry'?btn('Replace sample record','replace',`data-doc="${docId}"`,'small'):''}`);
  }
  function reviewModal(docId) {
    if(!staff)return;
    const c=current(),d=c.documents.find(x=>x.documentTypeId===docId),def=model.docType(docId);
    if(def.handling==='decision_record')return decisionsModal();
    if(d.status==='missing'&&def.handling==='digital_copy')return receiptModal(docId);
    openModal(`Review ${esc(def.title.toLowerCase())}`,`${badge(d.status)}<p>${esc(d.note||def.requirement)}</p>${d.sampleFileName?`<p class="small-text">Sample record: ${esc(d.sampleFileName)}</p>`:''}${def.handling==='sealed_original'?'<div class="notice">Verify the physical original through the approved process. A scan or delivery note is not verification.</div>':''}${selectField('Review outcome','status',[['accepted',def.handling==='sealed_original'?'Originals verified':def.handling==='inspection_record'?'Review completed':'Accept record'],['needs_changes','Request changes']],d.status==='needs_changes'?'needs_changes':'accepted')}<label class="field"><span>Review note / specific change required</span><textarea name="note" rows="4" required maxlength="1500"></textarea></label><p class="small-text muted">Simulated review. This saves a local case update only.</p>`,v=>{if(v.status==='accepted'&&['inspection_record','completion_record','restricted_record','sealed_original'].includes(def.handling))model.recordCompletion(c.id,docId,v.note);else model.reviewEvidence(c.id,docId,v);closeModal();persist(v.status==='accepted'?'Review recorded':'Correction request recorded');},'Record review');
  }
  function receiptModal(docId) {
    const c=current(),def=model.docType(docId);
    openModal('Record received evidence',`<h3>${esc(def.title)}</h3><p>Record the sample report as received, then review it in a separate step.</p>${field('Sample document name','fileName',`${docId.replaceAll('_','-')}-demo.pdf`,'text','required maxlength="120"')}<label class="field"><span>Receipt note</span><textarea name="note" rows="3" required maxlength="1200"></textarea></label><p class="small-text muted">This stores a local sample record, not an actual file.</p>`,v=>{model.addEvidence(c.id,docId,{...v,sample:true},'Ministry');closeModal();persist('Evidence recorded as received; review pending');},'Record received');
  }
  function stageModal() {
    if(!staff)return;
    const c=current(),pending=userDocs(c).filter(d=>model.docType(d.documentTypeId).stageId===c.currentStageId&&d.status!=='accepted'&&d.documentTypeId!=='banking_setup');
    openModal(`${stageName(c.currentStageId)} review`,`${pending.length?`<p>These items still need review:</p><ul>${pending.map(d=>`<li>${esc(model.docType(d.documentTypeId).title)} — ${esc(labels[d.status])}</li>`).join('')}</ul>`:'<p>The records for this stage have been reviewed.</p>'}<p class="small-text muted">Advancing a stage records progress in this demonstration. It does not issue a licence or award funding.</p>`,()=>{model.advance(c.id);closeModal();persist('Stage updated');},'Complete stage');
  }
  function decisionsModal() {
    const c=current();
    const details=['readiness','licence','funding'].map(k=>`<section class="decision-box"><div class="section-heading"><h3>${seed.workflow.decisionLabels[k]}</h3>${badge(c.decisions[k].status)}</div><p>${esc(c.decisions[k].note||seed.workflow.decisionHelp[k])}</p>${staff?btn('Record outcome','decision',`data-kind="${k}"`,'small'):''}</section>`).join('');
    openModal('Decisions',details);
  }
  function decisionModal(kind) {
    if(!staff)return;
    const options=kind==='readiness'?[['proceed','Proceed'],['paused','On hold']]:[['approved','Approved'],['declined','Declined'],['under_review','Under review'],...(kind==='funding'?[['not_requested','Not requested']]:[])];
    openModal(`Record ${seed.workflow.decisionLabels[kind].toLowerCase()}`,`<p>${esc(seed.workflow.decisionHelp[kind])}</p>${selectField('Outcome','status',options,'under_review')}<label class="field"><span>Reason and conditions</span><textarea name="note" rows="4" maxlength="1500" required></textarea></label><p class="small-text muted">Simulated decision only. No licence is issued and no funding is awarded.</p>`,v=>{model.decide(current().id,kind,v.status,v.note);closeModal();persist('Simulated decision recorded');},'Record outcome');
  }
  function submitModal() {
    if(staff)return;
    const form=$('#profile-form');
    if(form){if(!form.reportValidity())return;model.updateProfile(current().id,dataFrom(form),actor);profileDirty=false;persist('Details saved for review');}
    openModal('Review your application',`<p>Submit your completed application details for the next review step.</p><p class="notice">This is a local demonstration. Nothing is sent to the Government of Saskatchewan.</p>`,()=>{model.submit(current().id);closeModal();persist('Submitted for review in this demonstration');},'Submit in demo');
  }
  function messageModal() {
    openModal(staff?'Add a case note':'Message your coordinator',`<label class="field"><span>${staff?'Case note':'Message'}</span><textarea name="text" rows="5" required maxlength="2000"></textarea></label><p class="small-text muted">Saved to the local case activity. No message is sent to an official.</p>`,v=>{model.addMessage(current().id,v.text,actor);closeModal();persist('Added to case activity');},'Save to case');
  }
  function sourceLinks(ids) {return `<ul class="source-list">${seed.sources.filter(s=>ids.includes(s.id)).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p class="small-text muted">${esc(s.note)}</p></li>`).join('')}</ul>`;}
  function compareBody() {
    return `<p>Choose by the setting and operating model, not just the number of children.</p><div class="table-wrap"><table class="route-compare"><thead><tr><th>Application</th><th>What differs</th></tr></thead><tbody><tr><td>Family child care home</td><td>Home application, family assessment, household checks, home visits and fire/heating inspections.</td></tr><tr><td>Group family child care home</td><td>The same home application, plus assistant, staffing and group-capacity review.</td></tr><tr><td>Child care centre</td><td>Separate centre application. Organizational details, staffing, floor plans and public-health review. Development and funding consideration adds needs assessment and budgets.</td></tr></tbody></table></div><p>Home applicants must be Saskatchewan residents aged 18 or older. A centre may use an eligible organization, individual or partnership. Licence eligibility and funding eligibility are separate. For-profit, individual and partnership centre applicants use the licence-only pathway in this proposed service; the consultant must confirm the actual intake requirements.</p><p>Current maximums are 8 for a family home, 16 for a group home and 90 licensed centre spaces. Age mix, staffing, premises and licence conditions can reduce capacity. An assistant aged 18+ is required above 8 in a group home. Older forms may still show 12.</p>${sourceLinks(['home-process','home-form','centre-process','centre-form','regulations','act'])}`;
  }
  function infoModal(topic) {
    let title='About this dashboard',body='';
    if(topic==='about')body=`<p><strong>Local prototype · fictional sample cases</strong></p><p>${esc(seed.workflow.submissionNotice)}</p><p>Applicant and ministry dashboards are separate pages. They share updates when opened from the same local web address. When opened as individual files, use Export case and Import case to transfer a record.</p><p>Records are stored in this browser, on this device. Export a case to keep a backup. There is no sign-in, secure document service, live government connection or AI service in this prototype.</p><p>${esc(seed.workflow.dataNotice)}</p><details class="help-section"><summary>Current procedure and proposed improvements</summary><p>${esc(seed.workflow.currentProcedure)}</p><p>${esc(seed.workflow.prototypeProcedure)}</p><p>${esc(seed.workflow.existingSystems)}</p></details><details class="help-section"><summary>Official sources</summary>${sourceLinks(seed.sources.map(s=>s.id))}</details><div class="inline-actions">${btn('Import case','import','','small')}${btn('Reset sample cases','reset','','small danger')}</div>`;
    else if(topic==='route'){title='About this application type';body=`<h3>${esc(typeName(current().facilityTypeId))}</h3><p>${esc(model.type(current().facilityTypeId).currentProcedure)}</p><p>${esc(model.type(current().facilityTypeId).capacityNote)}</p>${compareBody()}`;}
    else if(topic==='compare'){title='Choose the right application';body=compareBody();}
    else if(topic==='status'){title='Status guide';body='<dl><dt><strong>Not provided</strong></dt><dd>The record or review is still outstanding.</dd><dt><strong>Awaiting review</strong></dt><dd>Received, but not accepted by the reviewer.</dd><dt><strong>Needs changes</strong></dt><dd>A specific update has been requested.</dd><dt><strong>Accepted</strong></dt><dd>Reviewed for this case; this does not itself grant a licence.</dd></dl>'}
    else if(topic==='decisions'){title='Separate decisions';body=Object.values(seed.workflow.decisionHelp).map(x=>`<p>${esc(x)}</p>`).join('')+`<p>${esc(seed.workflow.decisionNotice)}</p>`;}
    else if(topic==='reuse'){title='One shared application record';body='<p>Contact, location and proposed capacity are entered once and reused throughout this case. Changes to the address or capacity flag affected premises reviews for another look.</p><p>The checklist is tailored to the type of care, applicant structure and rented or owned premises.</p>';}
    else if(topic==='documents'){title='About required records';body=`<p>This is an illustrative checklist for a proposed consolidated service. Your consultant must confirm the records and conditions for an actual application.</p><p>${esc(seed.workflow.originalCheckHandling)}</p><p>Sample evidence records contain a document name and note only. The prototype does not store uploaded documents.</p>`;}
    else if(topic.startsWith('document:')) {const def=model.docType(topic.slice(9));title=def.title;let ids=def.sourceIds;if(def.id==='licence_application')ids=[current().facilityTypeId==='centre'?'centre-form':'home-form'];body=`<p>${esc(def.requirement||'')}</p><p>${esc(def.note||'')}</p>${sourceLinks(ids)}`;}
    openModal(esc(title),body,null,'Save',topic==='compare'||topic==='route');
  }
  function downloadCase() {const blob=new Blob([JSON.stringify(model.exportCase(current().id),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${current().applicationNumber||current().id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Case export prepared');}
  function importModal() {
    openModal('Import a case',`<label class="field"><span>Exported case file (.json)</span><input id="import-file" type="file" accept=".json,application/json" required></label><p class="small-text muted">Choose a case exported from either dashboard. Existing cases are kept unless you explicitly replace one.</p>`,async()=>{const file=$('#import-file').files[0];if(!file)throw new Error('Choose an exported case file.');if(file.size>2000000)throw new Error('This file is too large. Choose a case export smaller than 2 MB.');const payload=JSON.parse(await file.text());if(payload?.case?.id&&model.state.cases.some(c=>c.id===payload.case.id)){openModal('Replace the existing case?',`<p>A case with this ID is already on this device. Importing will replace its current details and review history.</p><p><strong>${esc(payload.case.facilityName)}</strong></p>`,()=>{const c=model.importCase(payload,{replace:true});selectedId=c.id;queue=false;tab='overview';closeModal();persist('Case replaced from export');},'Replace case');return;}const c=model.importCase(payload);selectedId=c.id;queue=false;tab='overview';closeModal();persist('Case imported');},'Import case');
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b)return;
    const a=b.dataset.action,doc=b.dataset.doc;
    try {
      if(a==='close')closeModal();
      else if(a==='queue'){queue=true;render();}
      else if(a==='open'){selectedId=b.dataset.id;queue=false;tab='overview';render();}
      else if(a==='tab'){tab=b.dataset.tab;render();}
      else if(a==='documents'){tab='documents';render();}
      else if(a==='application'){tab='application';render();}
      else if(a==='new'){newType='family_home';chooseType();}
      else if(a==='compare') {newType=$('input[name=facilityTypeId]:checked')?.value||newType;openModal('Choose the right application',compareBody(),()=>chooseType(),'Back to application',true);}
      else if(a==='info')infoModal(b.dataset.topic);
      else if(a==='evidence')evidenceModal(doc);
      else if(a==='replace'){const c=current(),d=c.documents.find(x=>x.documentTypeId===doc);if(d.status==='accepted'){openModal('Replace the accepted record?',`<p>The new sample record will need another Ministry review. The previous review remains in the activity history.</p>`,()=>{closeModal();openModal('Add replacement sample record',`${field('Sample document name','fileName',`${doc}-replacement-demo.pdf`,'text','required maxlength="120"')}<label class="field"><span>Reason for replacement</span><textarea name="note" rows="3" required maxlength="1200"></textarea></label><p class="small-text muted">No actual file is stored.</p>`,v=>{model.addEvidence(c.id,doc,{...v,sample:true});closeModal();persist('Replacement added for review');},'Replace record');},'Continue');}else evidenceModal(doc);}
      else if(a==='inspect')inspectModal(doc);
      else if(a==='review')reviewModal(doc);
      else if(a==='stage')stageModal();
      else if(a==='decisions')decisionsModal();
      else if(a==='decision')decisionModal(b.dataset.kind);
      else if(a==='submit')submitModal();
      else if(a==='message')messageModal();
      else if(a==='export')downloadCase();
      else if(a==='import')importModal();
      else if(a==='reset')openModal('Reset all sample cases?',`<p>This replaces every case on this device with the original examples. Export any work you want to keep first.</p>`,()=>{model=new ProviderModel(seed);selectedId=seed.meta.primaryCaseId;tab='overview';queue=false;closeModal();persist('Sample cases restored');},'Reset cases');
    } catch(error) {toast(error.message);}
  });
  document.addEventListener('submit',async e=>{
    e.preventDefault();
    if(e.target.id==='modal-form'&&modalSubmit){const submit=modalSubmit;const b=e.submitter;if(b)b.disabled=true;try{await submit(dataFrom(e.target));}catch(error){$('#modal-error').textContent=error instanceof SyntaxError?'This is not a valid case export. Choose a JSON file exported by this dashboard.':error.message;}finally{if(b)b.disabled=false;}}
    else if(e.target.id==='profile-form'){try{model.updateProfile(current().id,dataFrom(e.target),actor);profileDirty=false;persist('Shared application details saved');}catch(error){$('#profile-error').textContent=error.message;}}
  });
  document.addEventListener('input',e=>{if(e.target.closest('#profile-form'))profileDirty=true;if(e.target.id==='search'){query=e.target.value;const pos=e.target.selectionStart;render();$('#search').focus();$('#search').setSelectionRange(pos,pos);}});
  document.addEventListener('change',e=>{if(e.target.closest('#profile-form'))profileDirty=true;if(e.target.name==='organizationType'){const path=e.target.form?.querySelector('[name="pathway"]');if(path){const previous=path.value;const eligible=!['for_profit','individual','partnership'].includes(e.target.value);path.innerHTML=(eligible?'<option value="centre-development">Development & funding consideration</option>':'')+'<option value="licensing-only">Operating licence only</option>';path.value=eligible?previous:'licensing-only';}}if(e.target.id==='type-filter'){typeFilter=e.target.value;render();}if(e.target.id==='stage-filter'){stageFilter=e.target.value;render();}});
  window.addEventListener('storage',e=>{if(e.key===storageKey&&e.newValue){try{model=new ProviderModel(seed,JSON.parse(e.newValue));if(!(profileDirty&&tab==='application'))render();toast(profileDirty&&tab==='application'?'A review update arrived. Your unsaved details remain in this form.':'Case updated in the other dashboard');}catch{toast('An update could not be loaded. Export your current case before reloading.');}}});
  $('#modal').addEventListener('cancel',()=>{modalSubmit=null;});
  render();
})();
