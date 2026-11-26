(function (root, factory) {
  'use strict';
  var ProviderModel = factory();
  if (typeof module === 'object' && module.exports) module.exports = ProviderModel;
  if (root) root.ProviderModel = ProviderModel;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const STAGES = ['readiness', 'application', 'premises', 'final_review'];
  const DOC_STATUSES = ['missing', 'received', 'accepted', 'needs_changes'];
  const STAGE_STATUSES = ['not_started', 'in_progress', 'awaiting_review', 'needs_changes', 'complete'];
  const ACTORS = ['Applicant', 'Ministry', 'Inspector'];
  const ORGS = ['nonprofit', 'cooperative', 'municipality', 'for_profit', 'individual', 'partnership'];
  const NON_GATING = ['banking_setup', 'funding_decision', 'licence_decision'];
  const DEVELOPMENT_ONLY = ['centre_information', 'needs_assessment', 'budgets', 'banking_setup', 'funding_decision'];
  const DECISIONS = {
    readiness: ['not_submitted', 'under_review', 'awaiting_review', 'pending', 'proceed', 'reviewed', 'approved', 'needs_changes', 'paused', 'declined'],
    licence: ['not_submitted', 'under_review', 'pending', 'not_decided', 'needs_changes', 'approved', 'declined'],
    funding: ['not_requested', 'not_submitted', 'not_decided', 'under_review', 'pending', 'needs_changes', 'approved', 'declined']
  };
  const PHYSICAL_STATUSES = ['not_received', 'reported_sent', 'received_by_ministry', 'verified_by_ministry'];
  const PROFILE_FIELDS = ['contactName', 'email', 'address', 'city', 'capacity', 'openingDate', 'organizationType', 'householdAdults', 'informationSession', 'premisesTenure'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const reginaDate = at => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Regina', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at));
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };
  const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const text = (value, label, limit = 12000) => {
    assert(typeof value === 'string' && value.length <= limit, `${label} must be text of at most ${limit} characters.`);
    return value.trim();
  };
  const actorCheck = actor => assert(ACTORS.includes(actor), 'Choose Applicant, Ministry or Inspector as the actor.');
  const staffOnly = actor => assert(actor === 'Ministry', 'Only a Ministry reviewer can accept evidence or record this decision.');
  const label = status => ({ proceed: 'Proceed', reviewed: 'Reviewed', approved: 'Approved', under_review: 'Under review', awaiting_review: 'Awaiting review', not_decided: 'Not decided', not_submitted: 'Not submitted', not_requested: 'Not requested', needs_changes: 'Changes requested' }[status] || status.charAt(0).toUpperCase() + status.slice(1));
  function jsonSafe(value, depth = 0, budget = { count: 0 }) {
    assert(depth < 30 && ++budget.count < 30000, 'This case file is too large or deeply nested.');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'string') return assert(value.length <= 50000, 'A value in this case file is too long.');
    if (typeof value === 'number') return assert(Number.isFinite(value), 'Case numbers must be finite.');
    assert(typeof value === 'object', 'The case must contain only JSON data.');
    if (!Array.isArray(value)) assert(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'The case contains an unsupported object.');
    for (const key of Object.keys(value)) {
      assert(!['__proto__', 'constructor'].includes(key), 'The case contains an unsafe property.');
      jsonSafe(value[key], depth + 1, budget);
    }
  }
  function route(value, type) {
    if (type !== 'centre') {
      assert(value == null || ['home', 'home-licensing', 'home_licensing'].includes(value), 'Home cases use the home licensing pathway.');
      return 'home-licensing';
    }
    const normalized = (value || 'centre-development').replaceAll('_', '-');
    assert(['centre-development', 'licensing-only'].includes(normalized), 'Choose centre development or licensing only.');
    return normalized;
  }
  function organization(value, fallback) {
    const aliases = { 'non-profit': 'nonprofit', non_profit: 'nonprofit', 'co-operative': 'cooperative', co_operative: 'cooperative', 'for-profit': 'for_profit' };
    const result = aliases[value] || value || fallback;
    assert(ORGS.includes(result), 'Choose a supported organization type.');
    return result;
  }

  class ProviderModel {
    constructor(seed, savedState = null) {
      assert(isObject(seed) && Array.isArray(seed.cases) && Array.isArray(seed.documentTypes) && Array.isArray(seed.facilityTypes), 'The demo content is incomplete.');
      jsonSafe(seed);
      this.seed = clone(seed);
      this._counter = 0;
      this._types = new Map(this.seed.facilityTypes.map(t => [t.id, t]));
      this._docs = new Map(this.seed.documentTypes.map(d => [d.id, d]));
      if (savedState !== null) {
        jsonSafe(savedState);
        assert(savedState.version === 1 && Array.isArray(savedState.cases), 'This saved workspace has an unsupported format.');
        const cases = clone(savedState.cases);
        cases.forEach(c => this._validateCase(c));
        assert(new Set(cases.map(c => c.id)).size === cases.length, 'The saved workspace contains duplicate case IDs.');
        this.state = { version: 1, cases };
      } else {
        this.state = { version: 1, cases: this.seed.cases.map((c, i) => this._seedCase(c, i)) };
        this.state.cases.forEach(c => this._validateCase(c));
      }
    }

    case(id) {
      const c = this.state.cases.find(c => c.id === id);
      assert(c, 'That application could not be found.');
      return c;
    }
    type(id) {
      const result = this._types.get(id);
      assert(result, 'Choose a supported facility type.');
      return result;
    }
    docType(id) {
      const result = this._docs.get(id);
      assert(result, 'That document type is not recognized.');
      return result;
    }
    requirements(c) {
      if (typeof c === 'string') c = this.case(c);
      return c.documents.map(d => this.docType(d.documentTypeId));
    }
    _id(prefix) { return `${prefix}-${Date.now().toString(36)}-${(++this._counter).toString(36)}`; }
    _newCaseId() {
      const year = reginaDate(now()).slice(0, 4);
      const pattern = new RegExp(`^APP-${year}-(\\d+)$`);
      let largest = 0;
      for (const c of this.state.cases) for (const candidate of [c.id, c.applicationNumber]) {
        const match = typeof candidate === 'string' && candidate.match(pattern);
        if (match && Number.isSafeInteger(Number(match[1]))) largest = Math.max(largest, Number(match[1]));
      }
      return `APP-${year}-${String(largest + 1).padStart(3, '0')}`;
    }
    _event(c, actor, title, detail) {
      actorCheck(actor);
      const at = now();
      c.history.push({ id: this._id('event'), date: reginaDate(at), at, actor, title, detail });
      c.updatedAt = at;
      c.recordVersion = (c.recordVersion || 0) + 1;
    }
    _profile(fields, type, base = {}) {
      const result = { contactName: '', email: '', address: '', city: '', capacity: type === 'centre' ? 45 : 8, openingDate: '', organizationType: type === 'centre' ? 'nonprofit' : 'individual', householdAdults: type === 'centre' ? 0 : 1, informationSession: false, premisesTenure: 'rented', ...base };
      for (const key of PROFILE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
        const value = fields[key];
        if (['capacity', 'householdAdults'].includes(key)) {
          assert(value !== '' && value !== null && typeof value !== 'boolean', `Enter a number for ${key === 'capacity' ? 'capacity' : 'household adults'}.`);
          const number = Number(value);
          assert(Number.isInteger(number) && number >= (key === 'capacity' ? 1 : 0) && number <= 10000, `Enter a valid whole number for ${key === 'capacity' ? 'capacity' : 'household adults'}.`);
          result[key] = number;
        } else if (key === 'informationSession') {
          assert(typeof value === 'boolean', 'Information-session completion must be yes or no.');
          result[key] = value;
        } else if (key === 'organizationType') result[key] = organization(value, result[key]);
        else if (key === 'premisesTenure') {
          assert(['rented', 'owned'].includes(value), 'Choose rented or owned premises.');
          result[key] = value;
        } else result[key] = text(value, key, 1000);
      }
      assert(!result.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email), 'Enter a valid email address.');
      assert(!result.openingDate || (/^\d{4}-\d{2}-\d{2}$/.test(result.openingDate) && !Number.isNaN(Date.parse(result.openingDate)) && new Date(result.openingDate).toISOString().slice(0, 10) === result.openingDate), 'Use a valid opening date in YYYY-MM-DD format.');
      return result;
    }
    _expected(c) {
      this.type(c.facilityTypeId);
      return this.seed.documentTypes.filter(d => {
        if (!d.appliesTo.includes(c.facilityTypeId)) return false;
        if (c.facilityTypeId !== 'centre') return true;
        if (c.pathway === 'licensing-only' && DEVELOPMENT_ONLY.includes(d.id)) return false;
        if (d.id === 'incorporation') return ['nonprofit', 'cooperative', 'for_profit'].includes(c.profile.organizationType);
        if (d.id === 'lease') return c.profile.premisesTenure === 'rented';
        if (d.id === 'private_operator_check') return ['individual', 'partnership', 'for_profit'].includes(c.profile.organizationType);
        return true;
      });
    }
    _blankDoc(def) {
      const d = { documentTypeId: def.id, status: 'missing', owner: def.owner, note: '', updatedAt: now(), sampleFileName: null, evidenceVersions: [], version: 0 };
      if (def.handling === 'sealed_original') Object.assign(d, { originalDeliveryStatus: 'not_received', originalHandlingNote: 'Track physical delivery and Ministry verification separately. A scan is not a replacement.' });
      return d;
    }
    _sync(c) {
      const existing = new Map(c.documents.map(d => [d.documentTypeId, d]));
      c.documents = this._expected(c).map(def => {
        const d = existing.get(def.id) || this._blankDoc(def);
        if (!existing.has(def.id) && ['home_information', 'centre_information'].includes(def.id) && c.profile.informationSession) {
          d.status = 'received';
          d.note = 'Applicant reports completing the information session. Ministry review is pending.';
        }
        return d;
      });
      const current = new Set(c.documents.map(d => d.documentTypeId));
      c.corrections = c.corrections.filter(r => current.has(r.documentTypeId));
    }
    _seedCase(raw, i) {
      const c = clone(raw);
      const sessionRecord = c.documents.find(d => ['home_information', 'centre_information'].includes(d.documentTypeId));
      c.profile = this._profile({ city: c.city || 'Saskatoon', contactName: `Sample applicant ${i + 1}`, email: `applicant${i + 1}@example.test`, address: `${100 + i} Example Lane (fictional)`, capacity: c.facilityTypeId === 'centre' ? 45 : 8, informationSession: !!sessionRecord && ['received', 'accepted'].includes(sessionRecord.status), ...c.profile }, c.facilityTypeId);
      c.city = c.profile.city;
      c.pathway = route(c.pathway, c.facilityTypeId);
      c.status = c.status || (c.decisions.licence.status === 'approved' ? 'approved' : c.decisions.licence.status === 'not_submitted' && c.decisions.readiness.status === 'not_submitted' ? 'draft' : c.documents.some(d => d.status === 'needs_changes') ? 'needs_changes' : 'under_review');
      c.history = c.history || [];
      c.history = c.history.map(h => ({ ...h, at: h.at || h.date }));
      c.messages = c.messages || [];
      c.messages = c.messages.map(m => ({ ...m, at: m.at || m.date }));
      c.corrections = c.corrections || [];
      c.appointments = c.appointments || [];
      c.documents = c.documents.map(d => ({ ...this._blankDoc(this.docType(d.documentTypeId)), ...d, evidenceVersions: d.evidenceVersions || [], version: d.version || 0 }));
      this._sync(c);
      return c;
    }
    create(fields) {
      assert(isObject(fields), 'Enter the application details.');
      jsonSafe(fields);
      const type = this.type(fields.facilityTypeId);
      const profile = this._profile({ ...(fields.profile || {}), ...fields }, type.id);
      const at = now();
      const id = this._newCaseId();
      const c = { id, applicationNumber: id, facilityName: text(fields.facilityName || `New ${type.title.toLowerCase()}`, 'Facility name', 200), facilityTypeId: type.id, fictional: true, profile, city: profile.city, region: fields.region ? text(fields.region, 'Region', 100) : 'Not assigned', applicantLabel: profile.contactName || 'Applicant', coordinator: 'Not assigned', assignedTeam: 'Not assigned', pathway: route(fields.pathway, type.id), status: 'draft', currentStageId: 'readiness', summary: 'Draft application — not submitted.', createdAt: at, updatedAt: at, recordVersion: 1, stages: STAGES.map(stageId => ({ stageId, status: 'not_started' })), decisions: {}, documents: [], corrections: [], nextActions: [], history: [], messages: [], appointments: [] };
      for (const kind of Object.keys(DECISIONS)) c.decisions[kind] = { status: kind === 'funding' ? 'not_requested' : 'not_submitted', owner: 'Ministry', note: '', label: kind === 'funding' ? 'Not requested' : 'Not submitted' };
      c.decisions.funding.spaceAllocationStatus = 'not_decided';
      c.decisions.licence.note = 'No operating licence has been issued. This prototype records review progress only.';
      this._sync(c);
      c.stages.find(s => s.stageId === c.currentStageId).status = 'in_progress';
      this._event(c, 'Applicant', 'Draft created', 'This record exists only in the local demonstration.');
      this.state.cases.push(c);
      return c;
    }
    updateProfile(id, fields, actor = 'Applicant') {
      actorCheck(actor);
      assert(isObject(fields), 'Enter the profile changes.');
      jsonSafe(fields);
      const c = this.case(id);
      assert(!fields.facilityTypeId || fields.facilityTypeId === c.facilityTypeId, 'Create a new case to change the facility type.');
      const input = { ...(fields.profile || {}), ...fields };
      const next = this._profile(input, c.facilityTypeId, c.profile);
      assert(next.informationSession === c.profile.informationSession || actor === 'Applicant', 'Only the applicant can change their information-session completion report.');
      const name = fields.facilityName === undefined ? c.facilityName : text(fields.facilityName, 'Facility name', 200);
      assert(name.length > 0, 'Enter a facility name.');
      const pathway = route(fields.pathway === undefined ? c.pathway : fields.pathway, c.facilityTypeId);
      const changed = PROFILE_FIELDS.filter(k => next[k] !== c.profile[k]);
      if (name !== c.facilityName) changed.push('facilityName');
      if (pathway !== c.pathway) changed.push('pathway');
      if (!changed.length) return c;
      c.profile = next; c.city = next.city; c.facilityName = name; c.pathway = pathway; c.applicantLabel = next.contactName || 'Applicant';
      this._sync(c);
      const affected = new Set();
      if (changed.includes('informationSession')) {
        const session = c.documents.find(d => ['home_information', 'centre_information'].includes(d.documentTypeId));
        if (session) {
          const wasAccepted = session.status === 'accepted';
          session.status = next.informationSession ? 'received' : wasAccepted ? 'needs_changes' : 'missing';
          session.note = next.informationSession ? 'Applicant reports completing the information session. Ministry review is pending.' : 'Applicant no longer reports completing the information session. Completion needs to be confirmed again.';
          session.updatedAt = now();
          if (next.informationSession) {
            for (const correction of c.corrections.filter(r => r.documentTypeId === session.documentTypeId && r.status !== 'resolved')) Object.assign(correction, { status: 'responded', applicantResponse: session.note, responseAt: now() });
          } else if (wasAccepted || c.corrections.some(r => r.documentTypeId === session.documentTypeId && r.status !== 'resolved')) {
            this._openCorrection(c, session, session.note, 'Applicant');
          }
          affected.add(session.documentTypeId);
          c.stages.find(s => s.stageId === 'readiness').status = c.status === 'draft' ? 'in_progress' : session.status === 'needs_changes' ? 'needs_changes' : 'awaiting_review';
        }
      }
      if (changed.some(k => ['address', 'city', 'premisesTenure'].includes(k))) ['fire_inspection', 'heating_inspection', 'health_inspection', 'insurance', 'home_space', 'centre_plans', 'lease', 'final_visit'].forEach(k => affected.add(k));
      if (changed.includes('capacity')) ['fire_inspection', 'insurance', 'home_space', 'centre_plans', 'centre_staffing', 'group_staffing', 'final_visit'].forEach(k => affected.add(k));
      if (changed.includes('householdAdults') && c.facilityTypeId !== 'centre') ['household_checks', 'family_assessment', 'final_visit'].forEach(k => affected.add(k));
      if (changed.includes('organizationType')) ['incorporation', 'private_operator_check', 'licence_application', 'final_visit'].forEach(k => affected.add(k));
      const material = affected.size > 0 || changed.includes('pathway');
      const reason = `Review reopened because the shared profile changed: ${changed.join(', ')}.`;
      if (c.facilityTypeId === 'centre' && c.decisions.funding.status === 'approved' && changed.some(k => ['organizationType', 'pathway'].includes(k))) {
        Object.assign(c.decisions.funding, { status: 'under_review', label: 'Under review', note: 'The previously recorded funding approval needs review because the organization type or application pathway changed.', updatedAt: now() });
        const fundingDoc = c.documents.find(d => d.documentTypeId === 'funding_decision');
        if (fundingDoc) Object.assign(fundingDoc, { status: 'received', note: c.decisions.funding.note, updatedAt: now() });
      }
      for (const d of c.documents) if (d.status === 'accepted' && affected.has(d.documentTypeId)) {
        d.status = 'needs_changes'; d.note = reason; d.updatedAt = now();
        if (d.originalDeliveryStatus) d.originalDeliveryStatus = 'not_received';
        this._openCorrection(c, d, reason, 'Ministry');
      }
      if (material) {
        const licenseDoc = c.documents.find(d => d.documentTypeId === 'licence_decision');
        if (licenseDoc && licenseDoc.status === 'accepted') Object.assign(licenseDoc, { status: 'needs_changes', note: reason, updatedAt: now() });
        if (c.decisions.licence.status !== 'not_submitted') Object.assign(c.decisions.licence, { status: 'under_review', label: 'Under review', note: reason, updatedAt: now() });
        if (c.status !== 'draft') {
          c.status = c.documents.some(d => d.status === 'needs_changes') ? 'needs_changes' : 'under_review';
          const first = STAGES.find(stageId => this._missing(c, stageId).length);
          if (first) {
            c.currentStageId = first;
            for (const s of c.stages) if (STAGES.indexOf(s.stageId) >= STAGES.indexOf(first)) s.status = s.stageId === first ? (c.status === 'needs_changes' ? 'needs_changes' : 'awaiting_review') : 'not_started';
          }
        }
      }
      this._event(c, actor, 'Shared profile updated', material ? reason : `Updated ${changed.join(', ')}.`);
      return c;
    }
    _document(c, id) {
      const doc = c.documents.find(d => d.documentTypeId === id);
      assert(doc, 'That requirement does not apply to this case.');
      return doc;
    }
    _openCorrection(c, d, message, actor) {
      let r = c.corrections.find(r => r.documentTypeId === d.documentTypeId && r.status !== 'resolved');
      if (!r) { r = { id: this._id('correction'), documentTypeId: d.documentTypeId, title: this.docType(d.documentTypeId).title, applicantResponse: '', responseAt: null, resolution: null }; c.corrections.push(r); }
      Object.assign(r, { status: 'open', requestedAt: now(), requestedBy: actor, message });
      return r;
    }
    _updateStage(c, stageId) {
      const s = c.stages.find(s => s.stageId === stageId);
      const stageDocs = c.documents.filter(d => this.docType(d.documentTypeId).stageId === stageId && !NON_GATING.includes(d.documentTypeId));
      if (stageDocs.some(d => d.status === 'needs_changes')) s.status = 'needs_changes';
      else if (s.status !== 'complete' || stageDocs.some(d => d.status !== 'accepted')) s.status = 'awaiting_review';
      if (c.status !== 'draft' && stageDocs.some(d => d.status !== 'accepted') && STAGES.indexOf(stageId) < STAGES.indexOf(c.currentStageId)) {
        c.currentStageId = stageId;
        for (const later of c.stages) if (STAGES.indexOf(later.stageId) > STAGES.indexOf(stageId)) later.status = 'not_started';
      }
      if (c.status !== 'draft' && c.decisions.licence.status !== 'approved') c.status = c.documents.some(d => d.status === 'needs_changes') ? 'needs_changes' : 'under_review';
    }
    addEvidence(caseId, docId, evidence, actor = 'Applicant') {
      actorCheck(actor);
      assert(isObject(evidence), 'Add a document name or a note.');
      jsonSafe(evidence);
      assert(Object.keys(evidence).every(k => ['fileName', 'note', 'sample'].includes(k)), 'Only evidence metadata can be stored here; file contents are not supported.');
      const c = this.case(caseId), d = this._document(c, docId), def = this.docType(docId);
      assert(!['licence_decision', 'funding_decision'].includes(docId), 'Only a Ministry decision can complete this record.');
      assert(!(actor === 'Applicant' && def.owner === 'Ministry' && def.handling === 'inspection_record'), 'A staff reviewer must record this Ministry inspection or visit.');
      assert(def.handling !== 'sealed_original' || actor !== 'Inspector', 'Only the applicant or Ministry can record delivery of the original checks.');
      const fileName = evidence.fileName == null ? '' : text(evidence.fileName, 'File name', 255).split(/[\\/]/).pop();
      const note = evidence.note == null ? '' : text(evidence.note, 'Evidence note');
      assert(fileName || note, 'Add a document name or explain what you are providing.');
      assert(evidence.sample === undefined || typeof evidence.sample === 'boolean', 'The sample flag must be yes or no.');
      assert(def.handling !== 'sealed_original' || !fileName, 'Track the original checks as sent. A scanned file cannot replace the required physical originals.');
      const at = now();
      d.version += 1;
      d.evidenceVersions.push({ version: d.version, fileName: fileName || null, note, submittedAt: at, submittedBy: actor, sample: evidence.sample === true, metadataOnly: true, kind: def.handling === 'sealed_original' ? 'physical_delivery' : fileName ? 'file_metadata' : 'note' });
      d.status = 'received'; d.note = note; d.updatedAt = at; d.sampleFileName = fileName || null;
      if (def.handling === 'sealed_original') {
        d.originalDeliveryStatus = actor === 'Ministry' ? 'received_by_ministry' : 'reported_sent';
        d.originalHandlingNote = actor === 'Ministry' ? 'The Ministry records receipt of physical originals. Verification is still required.' : 'The applicant reports sending originals. Ministry receipt and verification are still required.';
      }
      if (actor === 'Applicant') for (const r of c.corrections.filter(r => r.documentTypeId === docId && r.status !== 'resolved')) Object.assign(r, { status: 'responded', applicantResponse: note || `Evidence supplied: ${fileName}`, responseAt: at });
      // New evidence supersedes prior acceptance. It cannot preserve an earlier licence approval.
      if (!NON_GATING.includes(docId) && c.decisions.licence.status === 'approved') {
        Object.assign(c.decisions.licence, { status: 'under_review', label: 'Under review', note: 'New evidence requires Ministry review.' });
        const ld = c.documents.find(x => x.documentTypeId === 'licence_decision');
        if (ld) Object.assign(ld, { status: 'needs_changes', note: 'New evidence requires review.' });
        c.currentStageId = def.stageId;
        c.stages.forEach(s => { if (STAGES.indexOf(s.stageId) >= STAGES.indexOf(def.stageId)) s.status = s.stageId === def.stageId ? 'awaiting_review' : 'not_started'; });
      }
      this._updateStage(c, def.stageId);
      this._event(c, actor, def.handling === 'sealed_original' ? actor === 'Ministry' ? 'Originals received' : 'Original delivery reported' : 'Evidence added', `${def.title}: ${fileName || note}`);
      return c;
    }
    reviewEvidence(caseId, docId, review, actor = 'Ministry') {
      staffOnly(actor);
      assert(isObject(review) && ['accepted', 'needs_changes'].includes(review.status), 'Choose accepted or changes requested.');
      const note = text(review.note == null ? '' : review.note, 'Review note');
      assert(review.status !== 'needs_changes' || note, 'Explain what the applicant needs to change.');
      const c = this.case(caseId), d = this._document(c, docId), def = this.docType(docId);
      assert(!['licence_decision', 'funding_decision'].includes(docId), 'Use the separate licence or funding decision action.');
      assert(review.status !== 'accepted' || d.status !== 'missing', 'Record evidence or completion before accepting this requirement.');
      d.status = review.status; d.note = note; d.updatedAt = now();
      if (review.status === 'accepted' && ['home_information', 'centre_information'].includes(docId)) c.profile.informationSession = true;
      if (def.handling === 'sealed_original' && review.status === 'accepted') {
        d.originalDeliveryStatus = 'verified_by_ministry'; d.originalHandlingNote = 'Physical originals verified by the Ministry reviewer.';
      }
      if (review.status === 'needs_changes') this._openCorrection(c, d, note, actor);
      else for (const r of c.corrections.filter(r => r.documentTypeId === docId && r.status !== 'resolved')) Object.assign(r, { status: 'resolved', resolution: note || 'Accepted by the Ministry reviewer.', resolvedAt: now() });
      if (review.status === 'needs_changes' && c.decisions.licence.status === 'approved' && !NON_GATING.includes(docId)) {
        Object.assign(c.decisions.licence, { status: 'under_review', label: 'Under review', note: 'A licensing requirement needs another review.' });
        const ld = c.documents.find(x => x.documentTypeId === 'licence_decision');
        if (ld) ld.status = 'needs_changes';
        c.currentStageId = def.stageId;
      }
      this._updateStage(c, def.stageId);
      this._event(c, actor, review.status === 'accepted' ? 'Evidence accepted' : 'Correction requested', `${def.title}${note ? ': ' + note : ''}`);
      return c;
    }
    recordCompletion(caseId, docId, note, actor = 'Ministry') {
      staffOnly(actor);
      const detail = text(note || '', 'Completion note');
      assert(detail, 'Explain what was completed or verified.');
      const c = this.case(caseId), d = this._document(c, docId);
      assert(!['licence_decision', 'funding_decision'].includes(docId), 'Use the separate decision action for this record.');
      d.status = 'received';
      if (this.docType(docId).handling === 'sealed_original') d.originalDeliveryStatus = 'received_by_ministry';
      return this.reviewEvidence(caseId, docId, { status: 'accepted', note: detail }, actor);
    }
    submit(caseId) {
      const c = this.case(caseId);
      assert(c.status === 'draft', 'This case is already submitted. Use its existing correction and evidence records.');
      assert(c.profile.contactName && c.profile.email && c.profile.city, 'Add a contact name, valid email and city before submitting.');
      c.currentStageId = 'readiness';
      c.status = 'under_review'; c.summary = 'Submitted in the local demonstration; awaiting review.';
      c.stages.find(s => s.stageId === c.currentStageId).status = 'awaiting_review';
      const kind = c.currentStageId === 'readiness' ? 'readiness' : 'licence';
      Object.assign(c.decisions[kind], { status: 'under_review', label: 'Under review', updatedAt: now() });
      this._event(c, 'Applicant', 'Application submitted in demo', 'No information was sent to the Ministry.');
      return c;
    }
    _missing(c, stageId = null) {
      return c.documents.filter(d => !NON_GATING.includes(d.documentTypeId) && (!stageId || this.docType(d.documentTypeId).stageId === stageId) && d.status !== 'accepted');
    }
    advance(caseId) {
      const c = this.case(caseId);
      assert(c.status !== 'draft', 'Submit the draft before advancing its review.');
      const missing = this._missing(c, c.currentStageId);
      assert(!missing.length, `Accept the current-stage requirements first: ${missing.map(d => this.docType(d.documentTypeId).title).join(', ')}.`);
      const index = STAGES.indexOf(c.currentStageId);
      c.stages.find(s => s.stageId === STAGES[index]).status = 'complete';
      if (index < STAGES.length - 1) {
        c.currentStageId = STAGES[index + 1];
        c.stages.find(s => s.stageId === STAGES[index + 1]).status = 'in_progress';
      }
      this._event(c, 'Ministry', 'Review stage advanced', index < STAGES.length - 1 ? `Next stage: ${c.currentStageId.replaceAll('_', ' ')}.` : 'Final review completed. Licence and funding decisions remain separate.');
      return c;
    }
    decide(caseId, kind, status, note) {
      assert(Object.hasOwn(DECISIONS, kind) && DECISIONS[kind].includes(status), 'Choose a valid decision and outcome.');
      const detail = text(note || '', 'Decision note');
      assert(detail, 'Add a reason or explanation for the decision.');
      const c = this.case(caseId);
      assert(c.status !== 'draft', 'Submit the draft before recording a decision.');
      if (kind === 'funding' && status === 'approved' && c.facilityTypeId === 'centre') {
        assert(c.pathway === 'centre-development' && ['nonprofit', 'cooperative', 'municipality'].includes(c.profile.organizationType), 'Centre funding approval requires the centre-development pathway and a nonprofit, cooperative or municipal organization. A licensing-only or private-operator application cannot be approved for this funding.');
      }
      if (kind === 'licence' && status === 'approved') {
        const missing = this._missing(c);
        assert(!missing.length, `The licence cannot be approved until these requirements are accepted: ${missing.map(d => this.docType(d.documentTypeId).title).join(', ')}.`);
      }
      const decisionNote = kind === 'licence' ? `${detail} This prototype does not issue a real licence.` : detail;
      Object.assign(c.decisions[kind], { status, label: label(status), note: decisionNote, owner: 'Ministry', updatedAt: now() });
      const d = c.documents.find(d => d.documentTypeId === `${kind}_decision`);
      if (d) Object.assign(d, { status: ['approved', 'declined'].includes(status) ? 'accepted' : 'received', note: detail, updatedAt: now() });
      if (kind === 'licence') {
        c.status = status === 'approved' ? 'approved' : status === 'needs_changes' ? 'needs_changes' : 'under_review';
        if (status === 'approved') { c.currentStageId = 'final_review'; c.stages.forEach(s => { s.status = 'complete'; }); }
      }
      this._event(c, 'Ministry', `${label(kind)} decision recorded`, `${label(status)}: ${detail}`);
      return c;
    }
    addMessage(id, message, actor = 'Applicant') {
      actorCheck(actor);
      const body = text(message, 'Message');
      assert(body, 'Write a message first.');
      const c = this.case(id), at = now();
      c.messages.push({ id: this._id('message'), date: reginaDate(at), at, author: actor, text: body });
      this._event(c, actor, 'Message added', body);
      return c;
    }
    exportCase(id) { return { format: 'sask-childcare-case', version: 1, case: clone(this.case(id)) }; }
    importCase(obj, options = { replace: false }) {
      jsonSafe(obj);
      assert(isObject(obj) && obj.format === 'sask-childcare-case' && obj.version === 1, 'Choose a version 1 Saskatchewan childcare case export.');
      assert(isObject(obj.case), 'The case record is missing.');
      assert(isObject(options) && (options.replace === undefined || typeof options.replace === 'boolean'), 'Replacement must be explicitly set to true or false.');
      const c = clone(obj.case);
      this._validateCase(c);
      const index = this.state.cases.findIndex(item => item.id === c.id);
      assert(index === -1 || options.replace === true, 'This case already exists. Explicitly choose replace to overwrite it.');
      if (index === -1) this.state.cases.push(c); else this.state.cases[index] = c;
      return c;
    }
    _validateCase(c) {
      assert(isObject(c), 'The case record is missing.');
      assert(typeof c.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(c.id), 'The case ID is invalid.');
      assert(typeof c.facilityName === 'string' && c.facilityName.trim() && c.facilityName.length <= 200, 'The case needs a facility name.');
      this.type(c.facilityTypeId);
      assert(isObject(c.profile) && PROFILE_FIELDS.every(k => Object.hasOwn(c.profile, k)), 'The case profile is incomplete.');
      const normalized = this._profile(c.profile, c.facilityTypeId);
      assert(PROFILE_FIELDS.every(k => normalized[k] === c.profile[k]), 'The case profile contains invalid or non-normalized values.');
      assert(c.pathway === route(c.pathway, c.facilityTypeId), 'The case pathway is invalid.');
      assert(c.city === c.profile.city, 'The facility city and shared profile must agree.');
      assert(['draft', 'under_review', 'needs_changes', 'approved'].includes(c.status), 'The case status is invalid.');
      assert(STAGES.includes(c.currentStageId), 'The current stage is invalid.');
      assert(Array.isArray(c.stages) && c.stages.length === STAGES.length && new Set(c.stages.map(s => s && s.stageId)).size === STAGES.length, 'The review stages are incomplete or duplicated.');
      c.stages.forEach(s => assert(isObject(s) && STAGES.includes(s.stageId) && STAGE_STATUSES.includes(s.status), 'A review-stage status is invalid.'));
      assert(isObject(c.decisions), 'The separate decisions are missing.');
      for (const kind of Object.keys(DECISIONS)) {
        const d = c.decisions[kind];
        assert(isObject(d) && DECISIONS[kind].includes(d.status) && d.owner === 'Ministry' && typeof d.note === 'string', `The ${kind} decision is invalid.`);
      }
      assert(Array.isArray(c.documents), 'The document checklist is missing.');
      const required = new Set(this._expected(c).map(d => d.id));
      assert(c.documents.length === required.size && new Set(c.documents.map(d => d && d.documentTypeId)).size === required.size, 'The document checklist is incomplete or duplicated.');
      for (const d of c.documents) {
        assert(isObject(d) && required.has(d.documentTypeId) && DOC_STATUSES.includes(d.status) && ACTORS.includes(d.owner) && typeof d.note === 'string', 'A document requirement is invalid.');
        assert(Object.keys(d).every(k => ['documentTypeId', 'status', 'owner', 'note', 'updatedAt', 'sampleFileName', 'evidenceVersions', 'version', 'originalDeliveryStatus', 'originalHandlingNote'].includes(k)), 'Document records may contain only review and evidence metadata.');
        assert(Array.isArray(d.evidenceVersions) && Number.isInteger(d.version) && d.version >= 0 && d.evidenceVersions.length === d.version, 'The evidence version history is invalid.');
        const def = this.docType(d.documentTypeId);
        d.evidenceVersions.forEach((v, index) => {
          assert(isObject(v) && Object.keys(v).every(k => ['version', 'fileName', 'note', 'submittedAt', 'submittedBy', 'sample', 'metadataOnly', 'kind'].includes(k)) && v.version === index + 1 && (v.fileName === null || typeof v.fileName === 'string') && typeof v.note === 'string' && typeof v.submittedAt === 'string' && ACTORS.includes(v.submittedBy) && typeof v.sample === 'boolean' && v.metadataOnly === true && ['file_metadata', 'note', 'physical_delivery'].includes(v.kind), 'Only valid evidence metadata may be imported.');
        });
        assert(d.sampleFileName === null || typeof d.sampleFileName === 'string', 'The evidence filename is invalid.');
        if (def.handling === 'sealed_original') {
          assert(PHYSICAL_STATUSES.includes(d.originalDeliveryStatus) && d.sampleFileName === null && d.evidenceVersions.every(v => v.fileName === null && v.kind === 'physical_delivery'), 'Original checks must use physical-delivery tracking, not uploaded files.');
          assert(d.status !== 'accepted' || d.originalDeliveryStatus === 'verified_by_ministry', 'Original checks cannot be accepted without Ministry verification.');
        }
      }
      assert(Array.isArray(c.corrections) && Array.isArray(c.messages) && Array.isArray(c.history), 'Case messages, corrections and history must be lists.');
      c.corrections.forEach(r => assert(isObject(r) && typeof r.id === 'string' && required.has(r.documentTypeId) && ['open', 'responded', 'resolved'].includes(r.status) && ACTORS.includes(r.requestedBy) && typeof r.message === 'string' && typeof r.applicantResponse === 'string', 'A correction record is invalid.'));
      c.messages.forEach(m => assert(isObject(m) && typeof m.id === 'string' && ACTORS.includes(m.author) && typeof m.text === 'string', 'A message is invalid.'));
      c.history.forEach(h => assert(isObject(h) && ACTORS.includes(h.actor) && typeof h.title === 'string' && typeof h.detail === 'string' && typeof h.date === 'string', 'A history entry is invalid.'));
      assert(c.decisions.licence.status !== 'approved' || (!this._missing(c).length && c.status === 'approved'), 'An approved licence must have a complete licensing review.');
      assert(c.status !== 'approved' || c.decisions.licence.status === 'approved', 'Approved case status requires a separate licence approval.');
      assert(!(c.facilityTypeId === 'centre' && c.decisions.funding.status === 'approved') || (c.pathway === 'centre-development' && ['nonprofit', 'cooperative', 'municipality'].includes(c.profile.organizationType)), 'The imported centre funding approval is incompatible with its application pathway or organization type.');
    }
  }
  return ProviderModel;
});
