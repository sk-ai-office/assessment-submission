const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ProviderModel = require('./src/model.js');
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'content.json'), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const make = () => new ProviderModel(seed);
const document = (c, id) => c.documents.find(d => d.documentTypeId === id);
const base = { facilityName: 'Test home — fictional', facilityTypeId: 'family_home', contactName: 'Sample applicant', email: 'sample@example.test', address: 'Example premises', city: 'Saskatoon', capacity: 8, householdAdults: 2, informationSession: true, premisesTenure: 'rented' };
const exempt = new Set(['banking_setup', 'funding_decision', 'licence_decision']);
function acceptLicensing(model, c) {
  for (const d of [...c.documents]) if (!exempt.has(d.documentTypeId)) model.recordCompletion(c.id, d.documentTypeId, 'Verified by the sample reviewer.');
}

test('flow 1: correction response retains versions and needs a separate reviewer acceptance', () => {
  const model = make(), c = model.case('APP-2026-001');
  assert.equal(c.status, 'needs_changes');
  const oldVersion = c.recordVersion;
  model.addEvidence(c.id, 'insurance', { fileName: 'coverage-dates.pdf', note: 'The dates now appear on page one.', sample: true });
  const d = document(c, 'insurance');
  assert.equal(d.status, 'received');
  assert.equal(d.version, 1);
  assert.equal(d.evidenceVersions[0].metadataOnly, true);
  assert.equal(c.corrections[0].status, 'responded');
  assert.ok(c.recordVersion > oldVersion);
  assert.throws(() => model.advance(c.id), /Accept the current-stage/);
  model.reviewEvidence(c.id, 'insurance', { status: 'needs_changes', note: 'Please show the expiry date too.' });
  model.addEvidence(c.id, 'insurance', { fileName: 'coverage-complete.pdf', note: 'Expiry included.', sample: true });
  assert.equal(d.evidenceVersions.length, 2);
  assert.equal(d.evidenceVersions[0].fileName, 'coverage-dates.pdf');
  model.reviewEvidence(c.id, 'insurance', { status: 'accepted', note: 'Dates verified.' });
  assert.equal(c.corrections[0].status, 'resolved');
  assert.equal(d.status, 'accepted');
  assert.equal(c.decisions.licence.status, 'under_review');
  assert.equal(c.decisions.funding.status, 'not_decided');
});

test('flow 2: home stages enforce evidence gates; funding never grants an operating licence', () => {
  const model = make(), c = model.create(base);
  assert.equal(c.status, 'draft');
  model.submit(c.id);
  model.decide(c.id, 'funding', 'approved', 'Fictional grant decision only.');
  assert.notEqual(c.decisions.licence.status, 'approved');
  assert.throws(() => model.decide(c.id, 'licence', 'approved', 'Too soon.'), /cannot be approved/);
  assert.throws(() => model.advance(c.id), /Applicant information session/);
  model.recordCompletion(c.id, 'home_information', 'Information session confirmed.');
  model.advance(c.id);
  assert.equal(c.currentStageId, 'application');
  for (const def of model.requirements(c).filter(d => d.stageId === 'application' && !exempt.has(d.id))) model.recordCompletion(c.id, def.id, 'Application record verified.');
  model.advance(c.id);
  assert.equal(c.currentStageId, 'premises');
  assert.equal(document(c, 'banking_setup').status, 'missing');
  for (const def of model.requirements(c).filter(d => d.stageId === 'premises')) model.recordCompletion(c.id, def.id, 'Premises requirement verified.');
  model.advance(c.id);
  model.recordCompletion(c.id, 'final_visit', 'Final consultant review completed.');
  model.advance(c.id);
  assert.notEqual(c.decisions.licence.status, 'approved');
  model.decide(c.id, 'licence', 'approved', 'Authorized sample reviewer decision.');
  assert.equal(c.status, 'approved');
  assert.match(c.decisions.licence.note, /does not issue a real licence/);
  assert.equal(c.decisions.funding.status, 'approved');
  assert.equal(document(c, 'licence_decision').status, 'accepted');
});

test('flow 3: centre route, legal entity and tenure drive the actual checklist', () => {
  // The small extra definition also exercises forward-compatible seed configuration.
  const fixture = copy(seed);
  if (!fixture.documentTypes.some(d => d.id === 'private_operator_check')) fixture.documentTypes.push({ id: 'private_operator_check', title: 'Private operator check', stageId: 'application', owner: 'Applicant', appliesTo: ['centre'], handling: 'restricted_record' });
  const model = new ProviderModel(fixture);
  const c = model.create({ ...base, facilityTypeId: 'centre', organizationType: 'for_profit', premisesTenure: 'owned', pathway: 'licensing_only', capacity: 40 });
  const ids = () => model.requirements(c).map(d => d.id);
  for (const id of ['centre_information', 'needs_assessment', 'budgets', 'banking_setup', 'funding_decision', 'lease']) assert.ok(!ids().includes(id));
  assert.ok(ids().includes('incorporation'));
  assert.ok(ids().includes('private_operator_check'));
  model.addEvidence(c.id, 'insurance', { fileName: 'insurance.pdf', note: 'Sample policy.' });
  const retained = document(c, 'insurance');
  model.updateProfile(c.id, { organizationType: 'individual', premisesTenure: 'rented' });
  assert.ok(!ids().includes('incorporation'));
  assert.ok(ids().includes('private_operator_check'));
  assert.ok(ids().includes('lease'));
  assert.equal(document(c, 'insurance'), retained);
  assert.equal(retained.version, 1);
  model.submit(c.id);
  assert.equal(c.currentStageId, 'readiness');
  assert.equal(c.decisions.readiness.status, 'under_review');
  assert.equal(c.decisions.licence.status, 'not_submitted');
  model.updateProfile(c.id, { organizationType: 'municipality', pathway: 'centre-development' });
  assert.ok(ids().includes('needs_assessment'));
  assert.ok(!ids().includes('private_operator_check'));
  assert.ok(!ids().includes('incorporation'));
  assert.equal(c.currentStageId, 'readiness');
});

test('flow 4: group-home original checks cannot be accepted by an applicant or replaced with a scan', () => {
  const model = make(), c = model.create({ ...base, facilityTypeId: 'group_home', capacity: 12 });
  assert.ok(document(c, 'group_staffing'));
  const before = copy(document(c, 'household_checks'));
  assert.throws(() => model.addEvidence(c.id, 'household_checks', { fileName: 'scan.pdf', note: 'A scan.' }), /physical originals/);
  assert.deepEqual(document(c, 'household_checks'), before);
  model.addEvidence(c.id, 'household_checks', { note: 'I mailed the sealed originals.', sample: true });
  const d = document(c, 'household_checks');
  assert.equal(d.originalDeliveryStatus, 'reported_sent');
  assert.equal(d.status, 'received');
  assert.equal(d.evidenceVersions[0].fileName, null);
  assert.throws(() => model.reviewEvidence(c.id, 'household_checks', { status: 'accepted', note: 'Self approval.' }, 'Applicant'), /Only a Ministry/);
  assert.throws(() => model.recordCompletion(c.id, 'household_checks', 'Self approval.', 'Applicant'), /Only a Ministry/);
  model.recordCompletion(c.id, 'household_checks', 'Ministry checked the physical originals.');
  assert.equal(d.originalDeliveryStatus, 'verified_by_ministry');
  assert.equal(d.status, 'accepted');
  model.addMessage(c.id, 'Please confirm the next appointment.');
  assert.equal(c.messages.at(-1).author, 'Applicant');
});

test('flow 5: material profile changes reopen affected premises and licence review, retaining unrelated evidence and funding', () => {
  const model = make(), c = model.create(base);
  model.submit(c.id);
  acceptLicensing(model, c);
  model.decide(c.id, 'licence', 'approved', 'Fictional licence decision.');
  assert.equal(c.decisions.funding.status, 'not_requested');
  model.decide(c.id, 'funding', 'approved', 'Independent fictional grant decision.');
  model.updateProfile(c.id, { contactName: 'Updated sample contact' });
  assert.equal(c.decisions.licence.status, 'approved');
  model.updateProfile(c.id, { address: 'Changed example premises', city: 'Regina', capacity: 7 });
  assert.equal(c.profile.city, 'Regina');
  assert.equal(c.city, 'Regina');
  assert.equal(c.currentStageId, 'premises');
  assert.equal(c.decisions.licence.status, 'under_review');
  assert.equal(c.decisions.funding.status, 'approved');
  assert.equal(document(c, 'fire_inspection').status, 'needs_changes');
  assert.equal(document(c, 'insurance').status, 'needs_changes');
  assert.equal(document(c, 'home_training').status, 'accepted');
  assert.equal(document(c, 'household_checks').status, 'accepted');
  assert.equal(document(c, 'final_visit').status, 'needs_changes');
  assert.match(c.history.at(-1).detail, /address, city, capacity/);
  assert.throws(() => model.decide(c.id, 'licence', 'approved', 'Too soon again.'), /cannot be approved/);
});

test('case export/import validates nested state, rejects duplicates, and does not mutate anything on failure', () => {
  const model = make(), exported = model.exportCase('APP-2026-001');
  exported.case.facilityName = 'Edited copy';
  assert.notEqual(model.case('APP-2026-001').facilityName, exported.case.facilityName);
  assert.throws(() => model.importCase(exported), /already exists/);
  model.importCase(exported, { replace: true });
  assert.equal(model.case('APP-2026-001').facilityName, 'Edited copy');
  const baseline = copy(model.state);
  const badCases = [
    e => { e.case.documents[0].status = 'automatically_approved'; },
    e => { e.case.stages[0].status = 'almost'; },
    e => { e.case.decisions.funding.owner = 'Applicant'; },
    e => { e.case.documents.pop(); },
    e => { e.case.profile.capacity = 'eight'; },
    e => { e.case.documents[0].bytes = 'pretend file contents'; },
    e => { e.case.profile.city = 'Unmirrored city'; },
    e => { e.case.decisions.licence.status = 'approved'; e.case.status = 'approved'; },
    e => { document(e.case, 'household_checks').originalDeliveryStatus = 'reported_sent'; },
    e => { e.case.corrections[0].documentTypeId = 'not-a-requirement'; }
  ];
  for (const change of badCases) {
    const bad = copy(exported); change(bad);
    assert.throws(() => model.importCase(bad, { replace: true }));
    assert.deepEqual(model.state, baseline);
  }
  assert.throws(() => model.importCase({ format: 'sask-childcare-case', version: 1 }), /case record is missing/i);
  assert.throws(() => model.importCase(JSON.parse('{"format":"sask-childcare-case","version":1,"__proto__":{"polluted":true}}')), /unsafe property/);
  assert.equal({}.polluted, undefined);
  const restored = new ProviderModel(seed, copy(model.state));
  assert.deepEqual(restored.state, model.state);
  assert.throws(() => new ProviderModel(seed, { version: 99, cases: [] }), /unsupported format/);
});

test('metadata-only guard and decision action separation cannot be bypassed by completion', () => {
  const model = make(), c = model.case('APP-2026-001');
  assert.throws(() => model.addEvidence(c.id, 'insurance', { fileName: 'sample.pdf', bytes: 'not allowed' }), /Only evidence metadata/);
  assert.throws(() => model.recordCompletion(c.id, 'licence_decision', 'Bypass approval.'), /separate decision/);
  assert.throws(() => model.reviewEvidence(c.id, 'funding_decision', { status: 'accepted' }), /separate licence or funding/);
  assert.throws(() => model.reviewEvidence(c.id, 'insurance', { status: 'needs_changes', note: '' }), /Explain what/);
  assert.throws(() => model.updateProfile(c.id, { openingDate: '2026-02-30' }), /valid opening date/);
  assert.throws(() => model.updateProfile(c.id, { facilityTypeId: 'centre' }), /new case/);
});

test('browser entry point exposes the same class without storage or Node globals', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'src/model.js'), 'utf8'), { window });
  assert.equal(typeof window.ProviderModel, 'function');
  assert.equal(typeof window.ProviderModel.prototype.addEvidence, 'function');
});

test('application numbers increment across existing records, imported numbers and saved workspaces', () => {
  const model = make(), first = model.create(base), second = model.create(base);
  const firstParts = first.id.match(/^APP-(\d{4})-(\d+)$/);
  assert.ok(firstParts);
  assert.equal(Number(second.id.split('-')[2]), Number(firstParts[2]) + 1);
  const imported = model.exportCase(first.id);
  imported.case.id = `APP-${firstParts[1]}-500`;
  imported.case.applicationNumber = imported.case.id;
  model.importCase(imported);
  const restored = new ProviderModel(seed, copy(model.state));
  assert.equal(restored.create(base).id, `APP-${firstParts[1]}-501`);
  const event = second.history.at(-1);
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Regina', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(event.at));
  assert.equal(event.date, local);
});

test('shared information-session report synchronizes evidence without approving it and reopens changed reviews', () => {
  const model = make();
  const home = model.create(base);
  assert.equal(document(home, 'home_information').status, 'received');
  assert.match(document(home, 'home_information').note, /Applicant reports/);
  const centre = model.create({ ...base, facilityTypeId: 'centre', informationSession: false });
  assert.equal(document(centre, 'centre_information').status, 'missing');
  model.updateProfile(centre.id, { informationSession: true });
  assert.equal(document(centre, 'centre_information').status, 'received');
  model.updateProfile(centre.id, { informationSession: false });
  assert.equal(document(centre, 'centre_information').status, 'missing');
  assert.throws(() => model.updateProfile(centre.id, { informationSession: true }, 'Ministry'), /Only the applicant/);
  assert.equal(centre.profile.informationSession, false);

  model.submit(home.id);
  acceptLicensing(model, home);
  model.decide(home.id, 'licence', 'approved', 'Fictional reviewer decision.');
  const acceptedHistory = home.history.filter(h => h.title === 'Evidence accepted').length;
  model.updateProfile(home.id, { informationSession: false });
  assert.equal(home.profile.informationSession, false);
  assert.equal(document(home, 'home_information').status, 'needs_changes');
  assert.equal(home.currentStageId, 'readiness');
  assert.equal(home.stages.find(s => s.stageId === 'readiness').status, 'needs_changes');
  assert.equal(home.decisions.licence.status, 'under_review');
  assert.equal(home.history.filter(h => h.title === 'Evidence accepted').length, acceptedHistory);
  model.updateProfile(home.id, { informationSession: true });
  assert.equal(document(home, 'home_information').status, 'received');
  assert.equal(home.corrections.find(r => r.documentTypeId === 'home_information').status, 'responded');
  assert.throws(() => model.advance(home.id), /Applicant information session/);
  model.reviewEvidence(home.id, 'home_information', { status: 'accepted', note: 'Completion verified again.' });
  assert.equal(home.profile.informationSession, true);
  assert.equal(home.corrections.find(r => r.documentTypeId === 'home_information').status, 'resolved');
  assert.equal(model.case('case-north').profile.informationSession, true);
});

test('centre funding approvals enforce the funded route and eligible entity, independently of licensing', () => {
  const model = make();
  for (const organizationType of ['for_profit', 'individual', 'partnership']) {
    const c = model.create({ ...base, facilityTypeId: 'centre', organizationType, pathway: 'centre-development' });
    model.submit(c.id);
    assert.throws(() => model.decide(c.id, 'funding', 'approved', 'Invalid funding approval.'), /Centre funding approval requires/);
    assert.equal(c.decisions.funding.status, 'not_requested');
  }
  const licensingOnly = model.create({ ...base, facilityTypeId: 'centre', organizationType: 'nonprofit', pathway: 'licensing-only' });
  model.submit(licensingOnly.id);
  assert.throws(() => model.decide(licensingOnly.id, 'funding', 'approved', 'Invalid route.'), /licensing-only/);
  acceptLicensing(model, licensingOnly);
  model.decide(licensingOnly.id, 'licence', 'approved', 'Licensing is independent.');
  assert.equal(licensingOnly.status, 'approved');
  assert.equal(licensingOnly.decisions.funding.status, 'not_requested');
  for (const organizationType of ['nonprofit', 'cooperative', 'municipality']) {
    const c = model.create({ ...base, facilityTypeId: 'centre', organizationType, pathway: 'centre-development' });
    model.submit(c.id);
    model.decide(c.id, 'funding', 'approved', 'Separate fictional grant decision.');
    assert.equal(c.decisions.funding.status, 'approved');
    assert.notEqual(c.decisions.licence.status, 'approved');
    model.updateProfile(c.id, { organizationType: 'for_profit', pathway: 'licensing-only' });
    assert.equal(c.decisions.funding.status, 'under_review');
    const invalid = model.exportCase(c.id);
    invalid.case.decisions.funding.status = 'approved';
    assert.throws(() => model.importCase(invalid, { replace: true }), /funding approval is incompatible/);
    assert.equal(c.decisions.funding.status, 'under_review');
  }
});

test('staff receipts retain actor and source owner while Ministry acceptance remains a separate action', () => {
  const model = make(), c = model.create(base);
  model.addEvidence(c.id, 'fire_inspection', { fileName: 'external-report.pdf', note: 'Report received from the inspector.', sample: true }, 'Ministry');
  const fire = document(c, 'fire_inspection');
  assert.equal(fire.status, 'received');
  assert.equal(fire.owner, 'Inspector');
  assert.equal(fire.evidenceVersions[0].submittedBy, 'Ministry');
  assert.equal(c.history.at(-1).actor, 'Ministry');
  model.addEvidence(c.id, 'heating_inspection', { fileName: 'heating.pdf', note: 'Inspector supplied report.' }, 'Inspector');
  assert.equal(document(c, 'heating_inspection').status, 'received');
  assert.equal(document(c, 'heating_inspection').evidenceVersions[0].submittedBy, 'Inspector');
  assert.throws(() => model.reviewEvidence(c.id, 'fire_inspection', { status: 'accepted', note: 'Inspector self-acceptance.' }, 'Inspector'), /Only a Ministry/);
  model.reviewEvidence(c.id, 'fire_inspection', { status: 'accepted', note: 'Ministry reviewed the report.' });
  assert.equal(fire.status, 'accepted');
  assert.throws(() => model.addEvidence(c.id, 'home_space', { note: 'Applicant self-recorded visit.' }), /staff reviewer/);
  assert.throws(() => model.addEvidence(c.id, 'insurance', { note: 'Invalid actor.' }, 'Robot'), /Choose Applicant/);
  model.addEvidence(c.id, 'household_checks', { note: 'Sealed originals physically received.' }, 'Ministry');
  assert.equal(document(c, 'household_checks').status, 'received');
  assert.equal(document(c, 'household_checks').originalDeliveryStatus, 'received_by_ministry');
});
