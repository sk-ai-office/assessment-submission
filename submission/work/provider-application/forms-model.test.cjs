'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const FormWorkspace = require('./src/forms-model.js');
const field = (id, type='text', required=true, extra={}) => ({id, label:id, type, required, ...extra});
const section = (owner, fields, id=owner) => ({id,title:id,owner,fields});
const form = (id, sections, extra={}) => ({id,title:id,types:['family_home','group_home','centre'],phase:'intake',kind:'form',required:true,sections,...extra});
const catalog = { forms: [
  form('intake',[section('Applicant',[
    field('contact','text',true,{bind:'profile.contactName'}), field('email','email'),
    field('choice','select',true,{options:[{value:'Yes',label:'Yes'},{value:'No',label:'No'}]}),
    field('explain','textarea',true,{when:[{field:'choice',equals:'Yes'}]}),
    field('consent','checkbox'), field('groups','checkbox_group',true,{options:[{value:'A',label:'A'},{value:'B',label:'B'}]}),
    field('draftSignature','signature',false),field('estimate','calculated',true)
  ]),section('Ministry',[field('review','textarea')]),section('External',[field('bankStamp')])]),
  form('staffing',[section('Applicant',[field('contactAgain','text',true,{bind:'profile.contactName'}),field('people','table',true,{minRows:1,columns:[field('name'),field('cost','currency')]})])]),
  form('conditional',[section('Applicant',[field('municipalNote','text',true,{when:[{key:'profile.organizationType',in:['municipality']}]})])]),
  form('optional',[section('Applicant',[field('purpose')])],{required:false,phase:'optional'}),
  form('unknown',[],{kind:'unavailable',phase:'preopening'}),
  form('fixed',[section('Applicant',[field('budget','table',true,{fixedRows:[{label:'Salary'}],columns:[field('label','text',false,{readonly:true}),field('amount','currency')]})])],{required:false,phase:'optional'})
]};
const raw = (id,name) => ({id,facilityName:name,facilityTypeId:'family_home',city:'Regina',documents:[{documentTypeId:'old',status:'accepted',sampleFileName:'old.pdf'}],decisions:{licence:{status:'approved'}},history:[],messages:[]});
const seed = {cases:[raw('APP-2026-001','Primary'),raw('APP-2026-002','Other')]};
const fresh = () => new FormWorkspace(seed,catalog);
const answer = m => m.saveForm('APP-2026-001','intake',{contact:'Jane',email:'jane@example.test',choice:'No',consent:true,groups:['A']});

test('legacy evidence is preserved without becoming digital answers; applicant isolation and sequential creation',()=>{
 const m=fresh(),c=m.case('APP-2026-001'); assert.equal(m.ownCases().length,1);assert.equal(c.legacyDocuments[0].sampleFileName,'old.pdf');assert.deepEqual(c.forms,{});assert.equal(c.decisions.licence.status,'approved');
 assert.throws(()=>m.saveForm('APP-2026-002','intake',{email:'a@b.test'}),/another applicant/);
 assert.throws(()=>m.updateProfile('APP-2026-002',{city:'Yorkton'}),/another applicant/);
 assert.throws(()=>m.addMessage('APP-2026-002','Hello'),/another applicant/);
 const n=m.create({facilityName:'New',facilityTypeId:'centre'});assert.equal(n.ownerId,'demo-applicant');assert.match(n.id,/^APP-\d{4}-\d{3,}$/);assert.notEqual(n.id,c.id);
});
test('partial saves, conditional requiredness, enum types and external/read-only ownership',()=>{
 const m=fresh();m.saveForm('APP-2026-001','intake',{email:'unfinished'});assert.equal(m.report('APP-2026-001','intake').complete,false);
 assert.throws(()=>m.saveForm('APP-2026-001','intake',{review:'Forged'}),/role/);
 assert.throws(()=>m.saveReviewFields('APP-2026-001','intake',{email:'Forged'}),/role/);
 assert.throws(()=>m.saveForm('APP-2026-001','intake',{bankStamp:'Forged'}),/role/);
 assert.throws(()=>m.saveReviewFields('APP-2026-001','intake',{bankStamp:'Forged'}),/role/);
 assert.throws(()=>m.saveForm('APP-2026-001','intake',{estimate:10}),/role/);
 assert.throws(()=>m.saveForm('APP-2026-001','intake',{choice:'Maybe'}),/invalid choice/);
 answer(m);assert.equal(m.report('APP-2026-001','intake').complete,true);assert.equal(m.report('APP-2026-001','intake','Ministry').complete,false);
 m.saveForm('APP-2026-001','intake',{choice:'Yes'});assert.deepEqual(m.report('APP-2026-001','intake').missing.map(x=>x.fieldId),['explain']);
 m.saveForm('APP-2026-001','intake',{explain:'Reason',groups:[]});assert.equal(m.report('APP-2026-001','intake').missing[0].fieldId,'groups');
});
test('submission excludes ministry/external fields; corrections retain snapshots and submitted diffs',()=>{
 const m=fresh();answer(m);m.submitForm('APP-2026-001','intake');assert.throws(()=>m.acceptForm('APP-2026-001','intake'),/Ministry fields/);
 m.saveReviewFields('APP-2026-001','intake',{review:'Checked'});assert.equal(m.record('APP-2026-001','intake').status,'submitted');m.acceptForm('APP-2026-001','intake','Reviewed');
 assert.throws(()=>m.requestChanges('APP-2026-001','intake',{fieldId:'email',note:''}),/specific change/);
 m.requestChanges('APP-2026-001','intake',{fieldId:'email',note:'Confirm the contact address'});
 m.saveForm('APP-2026-001','intake',{email:'new@example.test'});m.submitForm('APP-2026-001','intake');
 const r=m.record('APP-2026-001','intake');assert.equal(r.reviewNotes[0].status,'responded');const latest=r.revisions.at(-1);assert.equal(latest.action,'submitted');assert.ok(latest.changes.some(x=>x.fieldId==='email'&&x.before==='jane@example.test'&&x.after==='new@example.test'));
 m.acceptForm('APP-2026-001','intake');assert.equal(m.record('APP-2026-001','intake').reviewNotes[0].status,'resolved');assert.equal(m.case('APP-2026-001').decisions.licence.status,'approved');
});
test('table validation and shared profile edits reopen accepted forms without erasing review history',()=>{
 const m=fresh();answer(m);m.saveForm('APP-2026-001','staffing',{people:[{name:'Pat'}]});assert.match(m.report('APP-2026-001','staffing').missing[0].reason,/cost/);
 assert.throws(()=>m.saveForm('APP-2026-001','staffing',{people:[{name:'Pat',cost:-2}]}),/nonnegative/);
 m.saveForm('APP-2026-001','staffing',{people:[{name:'Pat',cost:0}]});m.submitForm('APP-2026-001','staffing');m.acceptForm('APP-2026-001','staffing');
 m.updateProfile('APP-2026-001',{contactName:'Changed'});assert.equal(m.fieldValue('APP-2026-001','intake','contact'),'Changed');assert.equal(m.record('APP-2026-001','staffing').status,'draft');assert.ok(m.record('APP-2026-001','staffing').revisions.some(r=>r.action==='accepted'));
 m.submitForm('APP-2026-001','conditional');m.acceptForm('APP-2026-001','conditional');m.updateProfile('APP-2026-001',{organizationType:'municipality'});assert.equal(m.record('APP-2026-001','conditional').status,'draft');assert.equal(m.report('APP-2026-001','conditional').complete,false);
});
test('fixed table labels remain immutable and required financial cells are blank until answered',()=>{
 const m=fresh();assert.equal(m.report('APP-2026-001','fixed').complete,false);assert.throws(()=>m.saveForm('APP-2026-001','fixed',{budget:[{label:'Other',amount:1}]}),/Fixed/);
 m.saveForm('APP-2026-001','fixed',{budget:[{label:'Salary',amount:20}]});assert.equal(m.report('APP-2026-001','fixed').complete,true);
});
test('package validation is atomic and phase-specific; unavailable later form does not block intake',()=>{
 const m=fresh();answer(m);assert.throws(()=>m.submitPackage('APP-2026-001'),/staffing/);assert.equal(m.record('APP-2026-001','intake').status,'draft');
 m.saveForm('APP-2026-001','staffing',{people:[{name:'Pat',cost:10}]});m.submitPackage('APP-2026-001');assert.equal(m.record('APP-2026-001','intake').status,'submitted');
 assert.throws(()=>m.submitPackage('APP-2026-001','preopening'),/unknown/);assert.equal(m.report('APP-2026-001','unknown').complete,false);
 m.enableForm('APP-2026-001','optional',true);assert.ok(m.applicable('APP-2026-001').some(f=>f.id==='optional'));assert.ok(m.packet('APP-2026-001').forms.some(f=>f.id==='optional'));
});
test('export/import rejects unknown fields, values, statuses, ownership replacement and prototype pollution',()=>{
 const m=fresh();answer(m);m.submitForm('APP-2026-001','intake');const data=m.exportCase('APP-2026-001');
 const target=new FormWorkspace({cases:[]},catalog);target.importCase(data);assert.throws(()=>target.importCase(data),/already exists/);target.importCase(data,{replace:true});
 const mutate=fn=>{const d=structuredClone(data);fn(d);assert.throws(()=>new FormWorkspace({cases:[]},catalog).importCase(d));};
 mutate(d=>d.case.forms.intake.values.email='different@example.test');mutate(d=>d.case.forms.intake.values.unlisted='x');mutate(d=>d.case.forms.intake.values.choice='Maybe');mutate(d=>d.case.forms.intake.status='approved');mutate(d=>d.case.unknown='x');mutate(d=>d.case.profile.organizationType='invented');
 const changed=structuredClone(data);changed.case.ownerId='sample-5';assert.throws(()=>target.importCase(changed,{replace:true}),/ownership/);
 assert.throws(()=>target.importCase(JSON.parse('{"format":"sk-childcare-forms","version":2,"case":{"__proto__":{}}}')),/Unsafe/);
 assert.deepEqual(new FormWorkspace(seed,catalog,m.state).exportCase('APP-2026-001'),data);
});
test('explicit seed answers may be submitted; v1 saves never infer answers from old evidence',()=>{
 const s=structuredClone(seed);s.cases[1].formAnswers={intake:{values:{contact:'Sam',email:'sam@example.test',choice:'No',consent:true,groups:['A']},staffValues:{review:'Prepared review'},status:'submitted'}};
 const m=new FormWorkspace(s,catalog);assert.equal(m.record('APP-2026-002','intake').status,'submitted');assert.equal(m.record('APP-2026-002','intake').revisions[0].action,'submitted');
 const v1=new FormWorkspace(s,catalog,{version:1,cases:s.cases});assert.deepEqual(v1.case('APP-2026-002').forms,{});
});

test('v1-created cases remain applicant-owned and profile routes/extra conditions are reusable',()=>{
 const added=raw('APP-2026-999','Earlier local case');const m=new FormWorkspace(seed,catalog,{version:1,cases:[...seed.cases,added]});
 assert.equal(m.case(added.id).ownerId,'demo-applicant');m.updateProfile(added.id,{firstName:'Jane',lastName:'Doe',phone:'555-0000',postalCode:'S0A 0A0',pathway:'licensing-only',ministryRequestedMedical:true});
 assert.equal(m.case(added.id).profile.centrePathway,'licensing-only');assert.equal(m.case(added.id).profile.ministryRequestedMedical,true);
});

test('an unset same-address checkbox shows mailing fields without fabricating an answer',()=>{
 const mailingCatalog={forms:[form('mailing',[section('Applicant',[
  field('mailingSame','checkbox',false),
  field('mailingAddress','text',true,{when:[{field:'mailingSame',equals:false}]}),
  field('optionalText','text',false),
  field('textDependent','text',false,{when:[{field:'optionalText',equals:false}]})
 ])])]};
 const m=new FormWorkspace(seed,mailingCatalog),id='APP-2026-001';
 assert.equal(m.fieldValue(id,'mailing','mailingSame'),undefined);
 assert.equal(m.fieldVisible(id,'mailing','mailingAddress'),true);
 assert.equal(m.fieldVisible(id,'mailing','textDependent'),false);
 assert.equal(m.report(id,'mailing').missing[0].fieldId,'mailingAddress');
 assert.deepEqual(m.case(id).forms,{});
 m.saveForm(id,'mailing',{mailingSame:true});
 assert.equal(m.fieldVisible(id,'mailing','mailingAddress'),false);
 assert.equal(m.report(id,'mailing').complete,true);
 m.saveForm(id,'mailing',{mailingSame:false});
 assert.equal(m.fieldVisible(id,'mailing','mailingAddress'),true);
 assert.equal(m.report(id,'mailing').complete,false);
});

test('current catalogue supports all three provider types, role-owned draft saves and export round trips',()=>{
 const realCatalog=require('./catalog.json'),realSeed=require('./content.json');
 const m=new FormWorkspace(realSeed,realCatalog);
 assert.equal(m.ownCases().length,1);
 const seen=new Set();
 for(const facilityTypeId of ['family_home','group_home','centre']) for(const applicationKind of ['new','expand']) {
  const c=m.create({facilityTypeId,facilityName:`Test ${facilityTypeId} ${applicationKind}`,profile:{applicationKind,contactName:'Test contact',city:'Regina'}});
  for(const f of m.applicable(c,{includeOptional:true})) {
   seen.add(f.id);assert.doesNotThrow(()=>m.report(c,f.id));assert.doesNotThrow(()=>m.report(c,f.id,'Ministry'));
   if(f.kind==='unavailable')continue;
   for(const actor of ['Applicant','Ministry']) {
    const values={};
    for(const s of f.sections.filter(s=>s.owner===actor))for(const field of s.fields)if(field.type!=='calculated'&&!field.bind) {
     values[field.id]=field.type==='table'?(field.fixedRows||[]):field.type==='checkbox_group'?[]:field.type==='checkbox'?false:'';
    }
    assert.doesNotThrow(()=>m.saveForm(c.id,f.id,values,actor),`${f.id} ${actor}`);
   }
  }
  const roundTrip=new FormWorkspace({cases:[]},realCatalog);assert.doesNotThrow(()=>roundTrip.importCase(m.exportCase(c.id)));
  assert.equal(roundTrip.case(c.id).facilityName,c.facilityName);
 }
 assert.ok(seen.size>50);
});

function budgetWorkspace(){
 const actual=structuredClone(require('./catalog.json'));
 const budget=actual.forms.find(f=>f.id==='centre_budget_template'),section=budget.sections.find(s=>s.id==='annual_operating_budget');
 // The source workbook has four manual annual PD cells; retain this fixture if the catalogue is being rebuilt in parallel.
 for(const suffix of ['memberships_seca_annual','workshops_conferences_annual','first_aid_cpr_cert_recert_annual','other_professional_development_annual']){
  const id='annual_operating_budget_'+suffix;if(!section.fields.some(f=>f.id===id))section.fields.push(field(id,'number',false));
 }
 for(const suffix of ['total_expenditures_monthly','total_revenue_annual','revenue_minus_expenditures_monthly']){
  const id='annual_operating_budget_'+suffix;if(!section.fields.some(f=>f.id===id))section.fields.push(field(id,'calculated',false));
 }
 const m=new FormWorkspace({cases:[]},actual),c=m.create({facilityTypeId:'centre',facilityName:'Budget test'});
 m.enableForm(c.id,'centre_budget_template',true);
 return {m,c,budget};
}

test('operating totals include food, other costs and other income while PD annual values stay separate',()=>{
 const {m,c}=budgetWorkspace(),p='annual_operating_budget_',f='centre_budget_template';
 assert.equal(m.fieldValue(c,f,p+'total_expenditures'),undefined);
 m.saveForm(c.id,f,{
  [p+'facility_fees_incl_parent_fee_grant_monthly']:5000,[p+'total_grants_monthly']:2000,[p+'other_revenue_monthly']:100,
  [p+'staff_wages_monthly']:4000,[p+'food_monthly']:300,[p+'other_monthly_2']:50,[p+'other_monthly_5']:20,
  [p+'memberships_seca_monthly']:10,[p+'memberships_seca_annual']:300
 });
 assert.equal(m.fieldValue(c,f,p+'total_expenditures_monthly'),4380);
 assert.equal(m.fieldValue(c,f,p+'total_expenditures'),52740);
 assert.equal(m.fieldValue(c,f,p+'total_revenue_annual'),85200);
 assert.equal(m.fieldValue(c,f,p+'revenue_minus_expenditures'),32460);
 assert.equal(m.fieldValue(c,f,p+'revenue_minus_expenditures_monthly'),2720);
 assert.equal(m.fieldValue(c,f,'annual_grants_total_grant'),undefined);
 const info=m.calculationInfo(c);assert.equal(info.unimplementedFields.length,28);assert.match(info.notes.join(' '),/older wage rates/);
 const packet=m.packet(c.id).forms.find(f=>f.id==='centre_budget_template');assert.equal(packet.values[p+'total_expenditures'],52740);
 assert.equal(Object.hasOwn(c.forms[f].values,p+'total_expenditures'),false);
});

test('annual totals wait for missing manual PD amounts and support zero and deficit budgets',()=>{
 const {m,c}=budgetWorkspace(),p='annual_operating_budget_',f='centre_budget_template';
 m.saveForm(c.id,f,{[p+'workshops_conferences_monthly']:100,[p+'food_monthly']:200});
 assert.equal(m.fieldValue(c,f,p+'total_expenditures_monthly'),300);
 assert.equal(m.fieldValue(c,f,p+'total_expenditures'),undefined);
 assert.equal(m.calculationInfo(c).missingInputs[0].fieldId,p+'workshops_conferences_annual');
 m.saveForm(c.id,f,{[p+'workshops_conferences_annual']:0});
 assert.equal(m.fieldValue(c,f,p+'total_expenditures'),2400);
 assert.equal(m.fieldValue(c,f,p+'revenue_minus_expenditures'),-2400);
 m.saveForm(c.id,f,{[p+'workshops_conferences_monthly']:0,[p+'food_monthly']:0});
 assert.equal(m.fieldValue(c,f,p+'total_expenditures'),0);
});

test('every source operating expense row contributes and calculations survive accepted-case round trip',()=>{
 const {m,c,budget}=budgetWorkspace(),p='annual_operating_budget_',f='centre_budget_template';
 const revenueIds=['facility_fees_incl_parent_fee_grant_monthly','total_grants_monthly','other_revenue_monthly'].map(k=>p+k);
 const expenses=budget.sections.find(s=>s.id==='annual_operating_budget').fields.filter(x=>x.type!=='calculated'&&/_monthly(?:_\d+)?$/.test(x.id)&&!revenueIds.includes(x.id));
 assert.equal(expenses.length,36);
 const values=Object.fromEntries(expenses.map(x=>[x.id,1]));
 for(const suffix of ['memberships_seca_annual','workshops_conferences_annual','first_aid_cpr_cert_recert_annual','other_professional_development_annual'])values[p+suffix]=10;
 values.preparation_review_relevant_fields_reviewed=true;
 m.saveForm(c.id,f,values);assert.equal(m.fieldValue(c,f,p+'total_expenditures_monthly'),36);assert.equal(m.fieldValue(c,f,p+'total_expenditures'),424);
 m.submitForm(c.id,f);m.acceptForm(c.id,f,'Arithmetic reviewed');
 const imported=new FormWorkspace({cases:[]},m.catalog);const record=imported.importCase(m.exportCase(c.id));
 assert.equal(imported.fieldValue(record,f,p+'total_expenditures'),424);
 assert.equal(record.forms[f].status,'accepted');
 assert.throws(()=>m.saveForm(c.id,f,{[p+'total_expenditures']:0}),/role/);
 m.saveForm(c.id,f,{[p+'food_monthly']:2});assert.equal(m.fieldValue(c,f,p+'total_expenditures'),436);assert.equal(m.record(c,f).status,'draft');
});
