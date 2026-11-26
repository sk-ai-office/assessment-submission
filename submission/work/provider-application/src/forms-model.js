(function (root, factory) {
  'use strict';
  const FormWorkspace = factory();
  if (typeof module === 'object' && module.exports) module.exports = FormWorkspace;
  if (root) root.FormWorkspace = FormWorkspace;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const TYPES = ['family_home', 'group_home', 'centre'];
  const ROLES = ['Applicant', 'Ministry'];
  const STATUSES = ['draft', 'submitted', 'changes_requested', 'accepted'];
  const FIELD_TYPES = ['text', 'textarea', 'number', 'currency', 'email', 'date', 'select', 'checkbox', 'checkbox_group', 'table', 'signature', 'calculated'];
  const ORGS = ['nonprofit', 'cooperative', 'municipality', 'for_profit', 'individual', 'partnership'];
  const PROFILE_DEFAULTS = { firstName: '', lastName: '', phone: '', postalCode: '', organizationName: '', existingLicenceNumber: '', regularLicenceSince: '', outdoorPlayArea: 'on-site', ministryRequestedMedical: false, ministryRequestedFinancials: false, alternateOutdoorPlanNeeded: false, requestingFunding: false, applicationKind: 'new', pathway: 'centre-development', centrePathway: 'centre-development', contactName: '', email: '', address: '', city: '', capacity: '', openingDate: '', organizationType: '', householdAdults: '', informationSession: false, premisesTenure: '' };
  const CASE_KEYS = ['id', 'applicationNumber', 'ownerId', 'facilityName', 'facilityTypeId', 'city', 'profile', 'forms', 'selectedOptionalFormIds', 'legacyDocuments', 'legacyData', 'decisions', 'history', 'messages', 'createdAt', 'updatedAt', 'recordVersion', 'fictional'];
  const RECORD_KEYS = ['values', 'staffValues', 'status', 'reviewNotes', 'revisions', 'updatedAt', 'submittedAt', 'acceptedAt'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const object = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const stamp = () => new Date().toISOString();
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const blank = v => v === undefined || v === null || v === '' || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
  const text = (v, name, max = 12000) => { assert(typeof v === 'string' && v.length <= max, `${name} must be text of at most ${max} characters.`); return v; };
  const keys = (o, allowed, name) => assert(object(o) && Object.keys(o).every(k => allowed.includes(k)), `${name} contains an unknown field.`);
  function safe(v, depth = 0, budget = { n: 0 }) {
    assert(depth < 40 && ++budget.n < 100000, 'The record is too large or deeply nested.');
    if (v === null || typeof v === 'boolean') return;
    if (typeof v === 'string') return assert(v.length <= 100000, 'A text value is too long.');
    if (typeof v === 'number') return assert(Number.isFinite(v), 'Numbers must be finite.');
    assert(typeof v === 'object', 'Only JSON data can be stored.');
    if (!Array.isArray(v)) assert([Object.prototype, null].includes(Object.getPrototypeOf(v)), 'Unsupported record object.');
    for (const k of Object.keys(v)) { assert(!['__proto__', 'constructor', 'prototype'].includes(k), 'Unsafe property in record.'); safe(v[k], depth + 1, budget); }
  }
  function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v; }
  function readPath(c, path) {
    if (typeof path !== 'string') return undefined;
    const parts = path.split('.');
    assert(parts.every(p => !['__proto__', 'constructor', 'prototype'].includes(p)), 'Unsafe binding.');
    return parts.reduce((v, p) => v == null ? undefined : v[p], c);
  }
  function options(f) { return (f.options || []).map(o => object(o) ? o.value : o); }

  class FormWorkspace {
    constructor(seed, catalog, saved = null) {
      assert(object(seed) && Array.isArray(seed.cases), 'Case seed is missing.');
      assert(object(catalog) && Array.isArray(catalog.forms), 'Form catalogue is missing.');
      safe(seed.cases); safe(catalog);
      this.seed = clone(seed); this.catalog = clone(catalog); this.currentOwnerId = 'demo-applicant'; this._counter = 0;
      this._schemas = new Map(); this._profileKeys = new Set(Object.keys(PROFILE_DEFAULTS));
      for (const f of this.catalog.forms) {
        assert(typeof f.id === 'string' && f.id && !this._schemas.has(f.id), 'Form IDs must be unique.');
        assert(['form', 'external', 'task', 'unavailable'].includes(f.kind) && ['intake', 'preopening', 'optional', 'review'].includes(f.phase), 'Invalid form kind or phase.');
        assert(Array.isArray(f.types) && f.types.every(t => TYPES.includes(t)) && Array.isArray(f.sections), 'Invalid form applicability or sections.');
        const ids = new Set();
        for (const s of f.sections) {
          assert([...ROLES, 'External'].includes(s.owner) && Array.isArray(s.fields), 'Sections need an Applicant, Ministry or External owner.');
          for (const field of s.fields) {
            assert(typeof field.id === 'string' && field.id && !ids.has(field.id) && FIELD_TYPES.includes(field.type), 'Fields need unique IDs and supported types.'); ids.add(field.id);
            if (field.bind) {
              assert(/^(profile\.[A-Za-z][\w]*|facilityName|city)$/.test(field.bind), 'Only shared profile, name or city bindings are supported.');
              if (field.bind.startsWith('profile.')) this._profileKeys.add(field.bind.slice(8));
            }
            if (field.type === 'table') {
              assert(Array.isArray(field.columns) && new Set(field.columns.map(c => c.id)).size === field.columns.length, 'Table columns must have unique IDs.');
              for (const col of field.columns) assert(FIELD_TYPES.includes(col.type) && col.type !== 'table' && !col.bind, 'Table columns must be unbound scalar fields.');
            }
          }
        }
        this._schemas.set(f.id, f);
      }
      const discoverConditions = value => {
        if (!value || typeof value !== 'object') return;
        if (typeof value.key === 'string' && /^profile\.[A-Za-z][\w]*$/.test(value.key)) this._profileKeys.add(value.key.slice(8));
        Object.values(value).forEach(discoverConditions);
      };
      discoverConditions(this.catalog);
      if (saved !== null) {
        safe(saved); keys(saved, ['version', 'cases'], 'Workspace');
        assert([1, 2].includes(saved.version) && Array.isArray(saved.cases), 'Unsupported saved workspace.');
        this.state = { version: 2, cases: saved.version === 1 ? saved.cases.map((c, i) => this._migrate(c, i, false)) : clone(saved.cases) };
      } else this.state = { version: 2, cases: seed.cases.map((c, i) => this._migrate(c, i, true)) };
      assert(new Set(this.state.cases.map(c => c.id)).size === this.state.cases.length, 'Duplicate application IDs.');
      this.state.cases.forEach(c => this._validateCase(c));
    }
    case(id) { const c = this.state.cases.find(c => c.id === id); assert(c, 'Application not found.'); return c; }
    ownCases() { return this.state.cases.filter(c => c.ownerId === this.currentOwnerId); }
    schema(id) { const f = this._schemas.get(id); assert(f, 'Unknown form.'); return f; }
    _case(c) { return typeof c === 'string' ? this.case(c) : c; }
    _role(actor) { assert(ROLES.includes(actor), 'Choose Applicant or Ministry.'); }
    _actor(c, actor) { this._role(actor); assert(actor !== 'Applicant' || c.ownerId === this.currentOwnerId, 'This application belongs to another applicant.'); }
    _id(prefix) { return `${prefix}-${Date.now().toString(36)}-${++this._counter}`; }
    _newRecord() { return { values: {}, staffValues: {}, status: 'draft', reviewNotes: [], revisions: [], updatedAt: stamp() }; }
    record(c, formId) { c = this._case(c); this.schema(formId); return c.forms[formId] || this._newRecord(); }
    _ensure(c, formId) { return c.forms[formId] || (c.forms[formId] = this._newRecord()); }
    _event(c, actor, title, detail) {
      const at = stamp(); c.history.push({ id: this._id('event'), at, date: at.slice(0, 10), actor, title, detail });
      c.updatedAt = at; c.recordVersion = (c.recordVersion || 0) + 1;
    }
    _migrate(raw, index, answers) {
      const at = stamp(), type = raw.facilityTypeId || 'family_home';
      assert(TYPES.includes(type), 'Unknown facility type.');
      const profile = { ...PROFILE_DEFAULTS };
      for (const k of this._profileKeys) if (raw.profile && own(raw.profile, k)) profile[k] = clone(raw.profile[k]);
      if (!profile.city) profile.city = raw.city || '';
      if (this._profileKeys.has('facilityName')) profile.facilityName = raw.facilityName || '';
      const seedIndex = this.seed.cases.findIndex(s => s.id === raw.id);
      const ownerId = seedIndex <= 0 ? this.currentOwnerId : `sample-${seedIndex + 1}`;
      if (!profile.organizationType) profile.organizationType = type === 'centre' ? 'nonprofit' : 'individual';
      const c = { id: raw.id, applicationNumber: raw.applicationNumber || raw.id, ownerId, facilityName: raw.facilityName || 'Untitled application', facilityTypeId: type, city: profile.city, profile, forms: {}, selectedOptionalFormIds: [], legacyDocuments: clone(raw.legacyDocuments || raw.documents || []), legacyData: clone(raw), decisions: clone(raw.decisions || {}), history: clone(raw.history || []), messages: clone(raw.messages || []), createdAt: raw.createdAt || at, updatedAt: at, recordVersion: raw.recordVersion || 0, fictional: true };
      if (answers && raw.formAnswers) for (const [id, input] of Object.entries(raw.formAnswers)) {
        const f = this.schema(id), rec = this._ensure(c, id);
        const structured = object(input) && (own(input, 'values') || own(input, 'staffValues'));
        for (const role of ROLES) {
          const vals = structured ? input[role === 'Applicant' ? 'values' : 'staffValues'] || {} : role === 'Applicant' ? input : {};
          this._validateValues(f, vals, role);
          for (const [key, value] of Object.entries(vals)) {
            const entry = this._entry(f, key); if (entry.field.bind) this._writeBind(c, entry.field.bind, clone(value));
            else rec[role === 'Applicant' ? 'values' : 'staffValues'][key] = clone(value);
          }
        }
        if (structured && input.status !== undefined) {
          assert(['draft', 'submitted'].includes(input.status), 'Seed forms may be draft or submitted only.');
          if (input.status === 'submitted') {
            assert(this.report(c, id).complete, 'Seeded submitted forms must have complete applicant answers.');
            this._revision(c, f, 'Applicant', 'submitted', { values: {}, staffValues: {} }); rec.status = 'submitted'; rec.submittedAt = stamp();
          }
        }
      }
      return c;
    }
    create(fields = {}) {
      safe(fields); keys(fields, ['facilityName', 'facilityTypeId', 'city', 'profile', ...this._profileKeys], 'New application');
      const type = fields.facilityTypeId || 'family_home'; assert(TYPES.includes(type), 'Choose a supported facility type.');
      const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Regina', year: 'numeric' }).format(new Date());
      const pattern = new RegExp(`^APP-${year}-(\\d+)$`);
      const largest = Math.max(0, ...this.state.cases.flatMap(c => [c.id, c.applicationNumber]).map(id => Number((String(id).match(pattern) || [])[1] || 0)));
      const id = `APP-${year}-${String(largest + 1).padStart(3, '0')}`;
      const profile = { ...PROFILE_DEFAULTS, organizationType: type === 'centre' ? 'nonprofit' : 'individual', ...(fields.profile || {}) };
      for (const k of this._profileKeys) if (own(fields, k)) profile[k] = fields[k];
      this._syncProfileAliases(profile, fields.profile || {}, fields);
      this._validateProfile(profile);
      const c = this._migrate({ id, facilityTypeId: type, facilityName: fields.facilityName || 'New application', profile }, 0, false);
      c.legacyData = {}; this._validateCase(c); this._event(c, 'Applicant', 'Application created', 'Local draft created.'); this.state.cases.push(c); return c;
    }
    _condition(c, condition, formId, row) {
      let value;
      if (condition.key) value = readPath(c, condition.key);
      else if (row && own(row, condition.field)) value = row[condition.field];
      else if (formId) {
        const entry = this._entry(this.schema(formId), condition.field, false);
        value = entry ? this.fieldValue(c, formId, entry.field, entry.owner) : undefined;
        // An absent checkbox renders unchecked; this affects visibility, not stored answers.
        if (value === undefined && entry?.field.type === 'checkbox' && condition.equals === false) value = false;
      }
      if (own(condition, 'in')) return Array.isArray(condition.in) && condition.in.includes(value);
      if (own(condition, 'equals')) return equal(value, condition.equals);
      return false;
    }
    _matches(c, list, formId, row) { return !list || list.every(cond => this._condition(c, cond, formId, row)); }
    applicable(c, { includeOptional = false, phase } = {}) {
      c = this._case(c);
      return this.catalog.forms.filter(f => f.types.includes(c.facilityTypeId) && this._matches(c, f.when) && (!phase || f.phase === phase) && (f.required || includeOptional || c.selectedOptionalFormIds.includes(f.id)));
    }
    _applicable(c, formId) { assert(this.applicable(c, { includeOptional: true }).some(f => f.id === formId), 'This form does not apply to the application.'); }
    _entry(form, id, required = true) {
      for (const s of form.sections) { const field = s.fields.find(f => f.id === id); if (field) return { field, owner: s.owner, section: s }; }
      assert(!required, 'Unknown form field.'); return null;
    }
    fieldValue(c, formId, field, owner) {
      c = this._case(c); if (typeof field === 'string') { const e = this._entry(this.schema(formId), field); field = e.field; owner = owner || e.owner; }
      owner = owner || this._entry(this.schema(formId), field.id).owner;
      if (owner === 'External') return undefined;
      if (field.type === 'calculated') return this._calculatedValue(c, formId, field.id);
      if (field.bind) return readPath(c, field.bind);
      const rec = c.forms[formId]; const value = rec && rec[owner === 'Ministry' ? 'staffValues' : 'values'][field.id];
      return value === undefined && field.type === 'table' && field.fixedRows ? clone(field.fixedRows) : value;
    }
    fieldVisible(c, formId, field, row) { c = this._case(c); if (typeof field === 'string') field = this._entry(this.schema(formId), field).field; return this._matches(c, field.when, formId, row); }
    _valueType(field, value) {
      if (value === null || value === '') return;
      if (field.type === 'checkbox') return assert(typeof value === 'boolean', `${field.label} must be yes or no.`);
      if (field.type === 'checkbox_group') return assert(Array.isArray(value) && value.every(v => options(field).includes(v)) && new Set(value).size === value.length, `${field.label} contains an invalid choice.`);
      if (['number', 'currency'].includes(field.type)) return assert(typeof value === 'number' && Number.isFinite(value) && (field.type !== 'currency' || value >= 0), `${field.label} must be a valid ${field.type === 'currency' ? 'nonnegative amount' : 'number'}.`);
      if (field.type === 'table') {
        assert(Array.isArray(value) && value.length <= 1000, `${field.label} must contain table rows.`);
        if (field.fixedRows) assert(value.length === field.fixedRows.length, `${field.label} has fixed rows.`);
        for (const [i, row] of value.entries()) { keys(row, field.columns.map(c => c.id), field.label); for (const [key, v] of Object.entries(row)) { const col = field.columns.find(c => c.id === key); this._valueType(col, v); if ((col.readonly || col.readOnly) && field.fixedRows) assert(equal(v, field.fixedRows[i][key]), 'Fixed table labels cannot be changed.'); } }
        return;
      }
      text(value, field.label || field.id);
      if (field.type === 'select') assert(options(field).includes(value), `${field.label} contains an invalid choice.`);
    }
    _validateValues(form, values, owner) {
      assert(object(values), 'Form answers must be an object.');
      for (const [id, value] of Object.entries(values)) {
        const e = this._entry(form, id); assert(e.owner === owner && e.field.type !== 'calculated', 'Only fields belonging to this role can be changed.'); this._valueType(e.field, value);
      }
    }
    _problems(c, formId, f, value, row) {
      if (f.type === 'calculated' || !this.fieldVisible(c, formId, f, row)) return [];
      if (blank(value) || (f.type === 'checkbox' && value !== true)) return f.required ? ['Required'] : [];
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return ['Enter a valid email'];
      if (f.type === 'date' && !validDate(value)) return ['Enter a valid date'];
      if (f.type === 'number' || f.type === 'currency') {
        if (typeof value !== 'number' || !Number.isFinite(value)) return ['Enter a number'];
        if (f.type === 'currency' && value < 0) return ['Amount cannot be negative'];
        if (f.min !== undefined && value < f.min) return [`Minimum ${f.min}`];
        if (f.max !== undefined && value > f.max) return [`Maximum ${f.max}`];
      }
      if (f.type === 'table') {
        if (!Array.isArray(value)) return ['Enter table rows'];
        const errors = [];
        if (value.length < (f.minRows || (f.required ? 1 : 0))) errors.push(`Add at least ${f.minRows || 1} row(s)`);
        value.forEach((r, i) => f.columns.forEach(col => this._problems(c, formId, col, r[col.id], r).forEach(reason => errors.push(`Row ${i + 1}, ${col.label}: ${reason}`))));
        return errors;
      }
      return [];
    }
    report(c, formId, role = 'Applicant') {
      c = this._case(c); this._role(role); const form = this.schema(formId); const missing = []; let total = 0, answered = 0;
      if (form.kind === 'unavailable') return { complete: false, total: 1, answered: 0, missing: [{ fieldId: null, label: form.title, section: '', reason: 'Official form or requirements are not yet available' }] };
      for (const section of form.sections.filter(s => s.owner === role)) for (const field of section.fields) {
        if (field.type === 'calculated' || !this.fieldVisible(c, formId, field)) continue;
        const problems = this._problems(c, formId, field, this.fieldValue(c, formId, field, role));
        if (field.required) { total++; if (!problems.length) answered++; }
        problems.forEach(reason => missing.push({ fieldId: field.id, label: field.label, section: section.title || section.id, reason }));
      }
      if (role === 'Applicant' && form.kind === 'external' && !total) missing.push({ fieldId: null, label: form.title, section: '', reason: 'Required evidence metadata and delivery details have not been specified' });
      return { complete: !missing.length, total, answered, missing };
    }
    _context(c, form) {
      return { applies: form.types.includes(c.facilityTypeId) && this._matches(c, form.when), visible: form.sections.flatMap(s => s.fields.filter(f => this.fieldVisible(c, form.id, f)).map(f => f.id)) };
    }
    _operatingBudget(c) {
      const form = this.schema('centre_budget_template');
      const all = form.sections.flatMap(s => s.fields);
      const prefix = 'annual_operating_budget_';
      const revenues = ['facility_fees_incl_parent_fee_grant_monthly', 'total_grants_monthly', 'other_revenue_monthly'].map(k => prefix + k);
      const pdPairs = [
        ['memberships_seca_monthly', 'memberships_seca_annual'],
        ['workshops_conferences_monthly', 'workshops_conferences_annual'],
        ['first_aid_cpr_cert_recert_monthly', 'first_aid_cpr_cert_recert_annual'],
        ['other_monthly_4', 'other_professional_development_annual']
      ].map(pair => pair.map(k => prefix + k));
      const pdMonthly = new Set(pdPairs.map(pair => pair[0]));
      const monthlyFields = all.filter(f => f.type !== 'calculated' && f.id.startsWith(prefix) && /_monthly(?:_\d+)?$/.test(f.id));
      const expenseFields = monthlyFields.filter(f => !revenues.includes(f.id));
      const values = c.forms.centre_budget_template?.values || {};
      const amount = id => typeof values[id] === 'number' && Number.isFinite(values[id]) ? values[id] : 0;
      const annualIds = pdPairs.map(pair => pair[1]);
      const hasInput = [...monthlyFields.map(f => f.id), ...annualIds].some(id => typeof values[id] === 'number');
      const missingInputs = pdPairs.filter(([monthly, annual]) => amount(monthly) !== 0 && blank(values[annual])).map(([, id]) => ({ fieldId: id, reason: 'Enter the separate annual professional-development amount, including zero if appropriate.' }));
      const sum = ids => ids.reduce((total, id) => total + amount(id), 0);
      const rounded = value => Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : undefined;
      const monthlyRevenue = sum(revenues), monthlyExpense = sum(expenseFields.map(f => f.id));
      const annualRevenue = monthlyRevenue * 12;
      const annualExpense = sum(expenseFields.filter(f => !pdMonthly.has(f.id)).map(f => f.id)) * 12 + sum(annualIds);
      const monthly = hasInput ? { revenue: rounded(monthlyRevenue), expenses: rounded(monthlyExpense), balance: rounded(monthlyRevenue - monthlyExpense) } : {};
      const annual = hasInput ? { revenue: rounded(annualRevenue), expenses: missingInputs.length ? undefined : rounded(annualExpense), balance: missingInputs.length ? undefined : rounded(annualRevenue - annualExpense) } : {};
      return { status: !hasInput ? 'empty' : missingInputs.length ? 'partial' : 'ready', monthly, annual, missingInputs };
    }
    _calculatedValue(c, formId, fieldId) {
      if (formId !== 'centre_budget_template') return undefined;
      const paths = {
        annual_operating_budget_total_expenditures: ['annual', 'expenses'],
        annual_operating_budget_revenue_minus_expenditures: ['annual', 'balance'],
        annual_operating_budget_total_expenditures_monthly: ['monthly', 'expenses'],
        annual_operating_budget_total_revenue_annual: ['annual', 'revenue'],
        annual_operating_budget_revenue_minus_expenditures_monthly: ['monthly', 'balance']
      };
      const path = paths[fieldId];
      if (!path) return undefined;
      return this._operatingBudget(c)[path[0]][path[1]];
    }
    calculationInfo(c, formId = 'centre_budget_template') {
      c = this._case(c);
      if (formId !== 'centre_budget_template') return null;
      return {
        ...this._operatingBudget(c),
        label: 'Operating budget arithmetic — planned amounts, not a grant award',
        sourceUrl: 'https://publications.saskatchewan.ca/api/v1/products/125423/formats/146702/download',
        sourceVersion: 'Downloaded workbook metadata last modified 2025-02-11; arithmetic adapted from its Budget sheet.',
        notes: [
          'Enter facility fees and Ministry-confirmed grants as monthly revenue. No grant entitlement or current grant rate is calculated.',
          'Every monthly expense line is included, including Food and all Other rows omitted from some source subtotals.',
          'Annual non-professional-development expenses equal monthly amounts times 12. Four professional-development annual amounts are entered separately, as in source cells C39:C42.',
          'Blank inputs contribute zero except that a nonzero monthly professional-development cost needs its separate annual amount before annual expense and balance totals are shown.',
          'Source grant formulas use older wage rates and other unconfirmed assumptions. The Annual Grants section remains unimplemented and must not be treated as a completed grant estimate.'
        ],
        unimplementedFields: this.schema(formId).sections.flatMap(s => s.fields).filter(f => f.type === 'calculated' && f.id.startsWith('annual_grants_')).map(f => f.id)
      };
    }
    _snapshot(c, form, { includeCalculated = false } = {}) {
      const result = { values: {}, staffValues: {} };
      for (const s of form.sections) for (const f of s.fields) {
        if (f.type === 'calculated' && !includeCalculated) continue;
        const v = this.fieldValue(c, form.id, f, s.owner); if (v !== undefined) result[s.owner === 'Applicant' ? 'values' : 'staffValues'][f.id] = clone(v);
      }
      return result;
    }
    _revision(c, form, actor, action, before) {
      const rec = this._ensure(c, form.id), snapshot = this._snapshot(c, form);
      const changes = [];
      if (before) for (const key of ['values', 'staffValues']) for (const id of new Set([...Object.keys(before[key]), ...Object.keys(snapshot[key])])) if (!equal(before[key][id], snapshot[key][id])) changes.push({ fieldId: id, owner: key === 'values' ? 'Applicant' : 'Ministry', before: before[key][id] === undefined ? null : before[key][id], after: snapshot[key][id] === undefined ? null : snapshot[key][id] });
      rec.revisions.push({ id: this._id('revision'), at: stamp(), actor, action, snapshot, changes }); rec.updatedAt = stamp(); return rec;
    }
    _writeBind(c, path, value) {
      if (path.startsWith('profile.')) c.profile[path.slice(8)] = value; else c[path] = value;
      if (path === 'profile.city') c.city = value; if (path === 'city') c.profile.city = value;
      if (path === 'profile.facilityName') c.facilityName = value;
      if (path === 'facilityName' && this._profileKeys.has('facilityName')) c.profile.facilityName = value;
      if (path === 'profile.pathway') c.profile.centrePathway = value;
      if (path === 'profile.centrePathway') c.profile.pathway = value;
    }
    _syncProfileAliases(profile, ...inputs) {
      for (const input of inputs) { if (own(input, 'centrePathway')) profile.pathway = input.centrePathway; else if (own(input, 'pathway')) profile.centrePathway = input.pathway; }
    }
    _reopen(rec) { if (['accepted', 'submitted'].includes(rec.status)) { rec.status = 'draft'; delete rec.acceptedAt; } }
    saveForm(id, formId, values, actor = 'Applicant') {
      safe(values); const c = this.case(id); this._actor(c, actor); this._applicable(c, formId); const form = this.schema(formId); this._validateValues(form, values, actor);
      const next = clone(c), previous = new Map(), contexts = new Map();
      this.catalog.forms.forEach(f => { previous.set(f.id, this._snapshot(c, f)); contexts.set(f.id, this._context(c, f)); });
      const rec = this._ensure(next, formId);
      for (const [key, value] of Object.entries(values)) { const f = this._entry(form, key).field; if (f.bind) this._writeBind(next, f.bind, clone(value)); else rec[actor === 'Applicant' ? 'values' : 'staffValues'][key] = clone(value); }
      this._validateProfile(next.profile);
      let changed = false;
      for (const f of this.catalog.forms) if (!equal(previous.get(f.id), this._snapshot(next, f)) || !equal(contexts.get(f.id), this._context(next, f))) {
        changed = true; const r = this._ensure(next, f.id);
        // Ministry review fields do not undo an applicant submission; accepted records always reopen.
        if (r.status === 'accepted' || actor === 'Applicant') this._reopen(r);
        this._revision(next, f, actor, f.id === formId ? 'saved' : 'shared_profile_changed', previous.get(f.id));
      }
      if (!changed) return c;
      this._event(next, actor, 'Form answers saved', form.title); Object.assign(c, next); return c;
    }
    saveReviewFields(id, formId, values) { return this.saveForm(id, formId, values, 'Ministry'); }
    _validateProfile(profile) {
      keys(profile, [...this._profileKeys], 'Shared profile');
      for (const [k, v] of Object.entries(profile)) {
        assert(v === null || ['string', 'number', 'boolean'].includes(typeof v) || Array.isArray(v), 'Invalid profile value.');
        if (k === 'applicationKind') assert(['new', 'expand'].includes(v), 'Invalid application kind.');
        if (['pathway', 'centrePathway'].includes(k)) assert(['centre-development', 'licensing-only'].includes(v), 'Invalid centre pathway.');
        if (k === 'organizationType' && !blank(v)) assert(ORGS.includes(v), 'Invalid organization type.');
        if (k === 'premisesTenure' && !blank(v)) assert(['rented', 'owned'].includes(v), 'Invalid premises tenure.');
        if (['capacity', 'householdAdults'].includes(k) && !blank(v)) assert(typeof v === 'number' && Number.isInteger(v) && v >= 0, 'Profile counts must be nonnegative whole numbers.');
        if (k === 'informationSession') assert(typeof v === 'boolean', 'Session completion must be yes or no.');
      }
      for (const form of this.catalog.forms) for (const s of form.sections) for (const f of s.fields) if (f.bind && f.bind.startsWith('profile.') && own(profile, f.bind.slice(8))) this._valueType(f, profile[f.bind.slice(8)]);
    }
    updateProfile(id, fields, actor = 'Applicant') {
      safe(fields); const c = this.case(id); this._actor(c, actor);
      keys(fields, ['profile', 'facilityName', 'city', ...this._profileKeys], 'Shared profile update');
      const next = clone(c), input = { ...(fields.profile || {}) };
      for (const key of this._profileKeys) if (own(fields, key)) input[key] = fields[key];
      keys(input, [...this._profileKeys], 'Shared profile');
      Object.assign(next.profile, input); this._syncProfileAliases(next.profile, input);
      if (own(fields, 'facilityName')) next.facilityName = text(fields.facilityName, 'Facility name', 200);
      else if (own(input, 'facilityName')) next.facilityName = text(input.facilityName, 'Facility name', 200);
      if (this._profileKeys.has('facilityName')) next.profile.facilityName = next.facilityName;
      next.city = next.profile.city; this._validateProfile(next.profile); assert(next.facilityName.trim(), 'Enter a facility name.');
      if (equal(c.profile, next.profile) && c.facilityName === next.facilityName) return c;
      for (const f of this.catalog.forms) {
        const before = this._snapshot(c, f), after = this._snapshot(next, f);
        if (!equal(before, after) || !equal(this._context(c, f), this._context(next, f))) { this._reopen(this._ensure(next, f.id)); this._revision(next, f, actor, 'shared_profile_changed', before); }
      }
      this._event(next, actor, 'Shared profile updated', 'Bound answers updated; affected form reviews reopened.'); Object.assign(c, next); return c;
    }
    submitForm(id, formId) {
      const c = this.case(id); this._actor(c, 'Applicant'); this._applicable(c, formId); const f = this.schema(formId), report = this.report(c, formId);
      assert(report.complete, `Complete ${f.title}: ${report.missing.map(m => `${m.label}: ${m.reason}`).join('; ')}`);
      const rec = this._ensure(c, formId); assert(!['submitted', 'accepted'].includes(rec.status), 'This form is already submitted or accepted.');
      const prior = [...rec.revisions].reverse().find(r => r.action === 'submitted');
      this._revision(c, f, 'Applicant', 'submitted', prior ? prior.snapshot : { values: {}, staffValues: {} });
      rec.status = 'submitted'; rec.submittedAt = stamp();
      for (const note of rec.reviewNotes) if (note.status !== 'resolved') { note.status = 'responded'; note.respondedAt = stamp(); }
      this._event(c, 'Applicant', 'Form submitted', f.title); return c;
    }
    requestChanges(id, formId, { fieldId, note }, actor = 'Ministry') {
      assert(actor === 'Ministry', 'Only Ministry can request changes.'); const c = this.case(id); this._applicable(c, formId); const f = this.schema(formId), entry = this._entry(f, fieldId);
      assert(entry.owner === 'Applicant' && entry.field.type !== 'calculated', 'Choose a specific applicant field.');
      text(note, 'Correction reason'); assert(note.trim(), 'Explain the specific change needed.'); const rec = this._ensure(c, formId);
      rec.reviewNotes.push({ id: this._id('review'), fieldId, note: note.trim(), status: 'open', requestedAt: stamp(), requestedBy: 'Ministry' }); rec.status = 'changes_requested'; delete rec.acceptedAt; rec.updatedAt = stamp();
      this._event(c, 'Ministry', 'Changes requested', `${f.title}: ${note.trim()}`); return c;
    }
    acceptForm(id, formId, note = '', actor = 'Ministry') {
      assert(actor === 'Ministry', 'Only Ministry can accept a form.'); text(note, 'Review note'); const c = this.case(id); this._applicable(c, formId); const f = this.schema(formId), rec = this._ensure(c, formId);
      assert(rec.status === 'submitted', 'A current applicant submission is required.');
      assert(this.report(c, formId).complete && this.report(c, formId, 'Ministry').complete, 'Complete required applicant and Ministry fields before acceptance.');
      rec.status = 'accepted'; rec.acceptedAt = stamp(); rec.updatedAt = stamp();
      rec.reviewNotes.forEach(r => { if (r.status !== 'resolved') { r.status = 'resolved'; r.resolvedAt = stamp(); r.resolution = note || 'Accepted after review.'; } });
      this._revision(c, f, 'Ministry', 'accepted', this._snapshot(c, f)); this._event(c, 'Ministry', 'Form accepted', `${f.title}${note ? ': ' + note : ''}. This records form review, not a licence or funding approval.`); return c;
    }
    enableForm(id, formId, enabled) {
      const c = this.case(id); this._actor(c, 'Applicant'); this._applicable(c, formId); assert(typeof enabled === 'boolean', 'Select enabled or disabled.'); assert(!this.schema(formId).required, 'Required forms cannot be disabled.');
      c.selectedOptionalFormIds = c.selectedOptionalFormIds.filter(f => f !== formId); if (enabled) c.selectedOptionalFormIds.push(formId);
      this._event(c, 'Applicant', enabled ? 'Optional form added' : 'Optional form hidden', this.schema(formId).title); return c;
    }
    submitPackage(id, phase = 'intake') {
      const c = this.case(id); this._actor(c, 'Applicant'); assert(['intake', 'preopening', 'optional', 'review'].includes(phase), 'Invalid phase.');
      const forms = this.applicable(c, { phase }).filter(f => f.required && (f.kind === 'unavailable' || f.kind === 'external' || f.sections.some(s => s.owner === 'Applicant')));
      assert(forms.length, 'No required applicant forms in this phase.');
      const missing = forms.filter(f => !this.report(c, f.id).complete); assert(!missing.length, `Complete required forms first: ${missing.map(f => f.title).join(', ')}.`);
      // Validate the whole package before making any submission changes.
      for (const f of forms) if (!['submitted', 'accepted'].includes(this.record(c, f.id).status)) this.submitForm(id, f.id);
      this._event(c, 'Applicant', 'Phase package submitted', `${phase}: local form submission only.`); return c;
    }
    summary(c) {
      c = this._case(c); const forms = this.applicable(c).filter(f => f.required && (f.kind === 'unavailable' || f.kind === 'external' || f.sections.some(s => s.owner === 'Applicant')));
      return { total: forms.length, complete: forms.filter(f => this.report(c, f.id).complete).length, submitted: forms.filter(f => ['submitted', 'accepted'].includes(this.record(c, f.id).status)).length, accepted: forms.filter(f => this.record(c, f.id).status === 'accepted').length, reviewAttention: this.getAttention(c).length };
    }
    getAttention(c) {
      c = this._case(c); const items = [];
      for (const f of this.applicable(c)) {
        const rec = this.record(c, f.id);
        if (f.required) for (const missing of this.report(c, f.id).missing) items.push({ kind: 'missing', formId: f.id, ...missing });
        for (const r of rec.reviewNotes.filter(r => r.status !== 'resolved')) items.push({ kind: 'correction', formId: f.id, fieldId: r.fieldId, note: r.note, status: r.status, reviewId: r.id });
        if (rec.status === 'submitted') items.push({ kind: 'submitted', formId: f.id, label: f.title, reason: 'Awaiting Ministry review' });
      }
      return items;
    }
    addMessage(id, message, actor = 'Applicant') {
      const c = this.case(id); this._actor(c, actor); text(message, 'Message'); assert(message.trim(), 'Enter a message.'); const at = stamp();
      c.messages.push({ id: this._id('message'), author: actor, text: message.trim(), at, date: at.slice(0, 10) }); this._event(c, actor, 'Message added', message.trim()); return c;
    }
    packet(id) {
      const c = this.case(id);
      return { caseId: c.id, facilityName: c.facilityName, facilityTypeId: c.facilityTypeId, profile: clone(c.profile), generatedAt: stamp(), forms: this.applicable(c).filter(f => f.required || c.selectedOptionalFormIds.includes(f.id)).map(f => ({ id: f.id, title: f.title, kind: f.kind, phase: f.phase, required: f.required, sections: clone(f.sections), ...this._snapshot(c, f, { includeCalculated: true }), calculationInfo: f.id === 'centre_budget_template' ? this.calculationInfo(c, f.id) : null, status: this.record(c, f.id).status, applicant: this.report(c, f.id), ministry: this.report(c, f.id, 'Ministry'), reviewNotes: clone(this.record(c, f.id).reviewNotes) })), notice: 'Local demonstration. Form acceptance does not issue a licence or approve funding.' };
    }
    exportCase(id) { return { format: 'sk-childcare-forms', version: 2, case: clone(this.case(id)) }; }
    importCase(input, { replace = false } = {}) {
      safe(input); keys(input, ['format', 'version', 'case'], 'Export'); assert(input.format === 'sk-childcare-forms' && input.version === 2, 'Choose a version 2 childcare forms export.'); assert(typeof replace === 'boolean', 'Replacement must be explicitly true or false.');
      const c = clone(input.case); this._validateCase(c); const i = this.state.cases.findIndex(x => x.id === c.id); assert(i < 0 || replace, 'This case already exists; explicitly choose replacement.');
      if (i >= 0) assert(this.state.cases[i].ownerId === c.ownerId, 'An import cannot change application ownership.');
      if (i < 0) this.state.cases.push(c); else this.state.cases[i] = c; return c;
    }
    _validateCase(c) {
      keys(c, CASE_KEYS, 'Application');
      assert(typeof c.id === 'string' && /^[A-Za-z0-9][\w.-]{0,119}$/.test(c.id), 'Invalid application ID.');
      assert(typeof c.ownerId === 'string' && /^(demo-applicant|sample-\d+)$/.test(c.ownerId), 'Invalid application owner.');
      assert(TYPES.includes(c.facilityTypeId), 'Invalid facility type.'); text(c.facilityName, 'Facility name', 200); assert(c.facilityName.trim(), 'Facility name is required.');
      this._validateProfile(c.profile); assert(c.city === c.profile.city, 'City must agree with shared profile.');
      assert(object(c.forms) && Array.isArray(c.selectedOptionalFormIds), 'Missing form records.');
      assert(new Set(c.selectedOptionalFormIds).size === c.selectedOptionalFormIds.length && c.selectedOptionalFormIds.every(id => this._schemas.has(id) && !this.schema(id).required), 'Invalid optional form selection.');
      for (const [id, rec] of Object.entries(c.forms)) {
        const form = this.schema(id); keys(rec, RECORD_KEYS, 'Form record');
        assert(STATUSES.includes(rec.status) && Array.isArray(rec.reviewNotes) && Array.isArray(rec.revisions), 'Invalid form status or history.');
        this._validateValues(form, rec.values, 'Applicant'); this._validateValues(form, rec.staffValues, 'Ministry');
        for (const owner of ROLES) for (const key of Object.keys(rec[owner === 'Applicant' ? 'values' : 'staffValues'])) assert(!this._entry(form, key).field.bind, 'Bound answers must be held in the shared profile.');
        for (const note of rec.reviewNotes) {
          keys(note, ['id','fieldId','note','status','requestedAt','requestedBy','respondedAt','resolvedAt','resolution'], 'Review note');
          assert(this._entry(form, note.fieldId).owner === 'Applicant' && ['open','responded','resolved'].includes(note.status) && note.requestedBy === 'Ministry' && typeof note.note === 'string' && note.note.trim(), 'Invalid field-specific review note.');
        }
        for (const r of rec.revisions) {
          keys(r, ['id','at','actor','action','snapshot','changes'], 'Revision');
          assert(ROLES.includes(r.actor) && ['saved','shared_profile_changed','submitted','accepted'].includes(r.action), 'Invalid revision action.'); keys(r.snapshot, ['values','staffValues'], 'Revision snapshot');
          this._validateValues(form, r.snapshot.values, 'Applicant'); this._validateValues(form, r.snapshot.staffValues, 'Ministry');
          assert(Array.isArray(r.changes), 'Invalid revision changes.');
          for (const change of r.changes) { keys(change, ['fieldId','owner','before','after'], 'Field change'); const e = this._entry(form, change.fieldId); assert(e.owner === change.owner, 'Invalid change owner.'); this._valueType(e.field, change.before); this._valueType(e.field, change.after); }
        }
        if (['submitted','accepted'].includes(rec.status)) {
          const lastSubmitted = [...rec.revisions].reverse().find(r => r.action === 'submitted');
          assert(lastSubmitted && this.report(c, id).complete && equal(lastSubmitted.snapshot.values, this._snapshot(c, form).values), 'Submitted records require a complete current applicant snapshot.');
          if (rec.status === 'accepted') {
            const lastAccepted = [...rec.revisions].reverse().find(r => r.action === 'accepted');
            assert(this.report(c, id, 'Ministry').complete && lastAccepted && equal(lastAccepted.snapshot, this._snapshot(c, form)) && rec.reviewNotes.every(n => n.status === 'resolved'), 'Accepted record has unresolved review requirements.');
          }
        }
      }
      assert(Array.isArray(c.legacyDocuments) && object(c.legacyData) && object(c.decisions) && Array.isArray(c.history) && Array.isArray(c.messages), 'Invalid preserved records.');
      for (const m of c.messages) assert(object(m) && ROLES.includes(m.author) && typeof m.text === 'string', 'Invalid message.');
      assert(typeof c.createdAt === 'string' && typeof c.updatedAt === 'string' && Number.isInteger(c.recordVersion) && c.recordVersion >= 0 && c.fictional === true, 'Invalid record metadata.');
    }
  }
  return FormWorkspace;
});
