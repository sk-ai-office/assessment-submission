#!/usr/bin/env python3
"""Compile verified Saskatchewan provider form inventories into the local UI catalogue.
Only writes catalog.json. It does not submit applications or invent official form fields.
"""
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent
RESEARCH = ROOT / 'research'
OUTPUT = ROOT / 'catalog.json'
HOME_TYPES = ['family_home', 'group_home']
CENTRE_TYPES = ['centre']
FUNDED = ['nonprofit', 'cooperative', 'municipality']
PRIVATE = ['individual', 'partnership', 'for_profit']
CORPORATE = ['nonprofit', 'cooperative', 'for_profit']


def slug(value):
    return re.sub(r'[^a-z0-9]+', '_', str(value).lower()).strip('_') or 'field'


def clean(value):
    """Exclude researcher paths/technical field audits from the user-facing file."""
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()
                if k not in {'localFile', 'localSource', 'sourceTextPath', 'rawFieldAuditPath',
                             'fieldMap', 'sha256', 'pdfMappingCaution'} and not k.lower().endswith('path')}
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, str) and (value.startswith('/Users/') or value.startswith('work/provider-application/')):
        return None
    return value


def notes(*values):
    out = []
    for v in values:
        if isinstance(v, list):
            out.extend(notes(*v))
        elif isinstance(v, str) and v.strip():
            out.append(v.strip())
        elif isinstance(v, dict):
            out.append(json.dumps(clean(v), ensure_ascii=False))
    return list(dict.fromkeys(out))


def condition(key, values):
    return {'key': 'profile.' + key, 'in': values if isinstance(values, list) else [values]}


class Compiler:
    def __init__(self):
        self.home = json.loads((RESEARCH / 'home-forms.json').read_text())
        self.centre = json.loads((RESEARCH / 'centre-forms.json').read_text())
        fp = RESEARCH / 'centre-funding-forms.json'
        self.funding = json.loads(fp.read_text()) if fp.exists() else {'forms': [], 'sources': []}
        self.forms, self.sources = [], []
        self.source_maps, self.source_urls, self.ids = {}, {}, set()
        self.coverage = []
        for space, inventory in [('home', self.home), ('centre', self.centre), ('funding', self.funding)]:
            self.register_sources(space, inventory.get('sources', []))

    def register_sources(self, space, rows):
        self.source_maps[space] = {}
        for s in rows:
            url = s.get('url') or s.get('publicLink')
            if not url:
                continue
            parsed = urlsplit(url)
            # Government page case variants point to the same resource; preserve supplied citation URL.
            key = urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.lower().rstrip('/'), parsed.query, parsed.fragment))
            if key in self.source_urls:
                sid = self.source_urls[key]
            else:
                sid = space + '_source_' + slug(s.get('id') or s.get('title'))
                existing = {x['id'] for x in self.sources}
                base, n = sid, 2
                while sid in existing:
                    sid = base + '_' + str(n)
                    n += 1
                item = {'id': sid, 'title': s.get('title') or s.get('name') or s.get('id'), 'url': url}
                if s.get('version') is not None:
                    item['version'] = clean(s['version'])
                if s.get('verifiedOn'):
                    item['verifiedOn'] = s['verifiedOn']
                self.sources.append(item)
                self.source_urls[key] = sid
            self.source_maps[space][s['id']] = sid

    def source_ids(self, space, raw):
        output = []
        for rid in raw or []:
            sid = self.source_maps.get(space, {}).get(rid)
            if not sid and rid.startswith('funding-'):
                sid = self.source_maps['funding'].get(rid[len('funding-'):])
            if not sid:
                candidates = [m[rid] for m in self.source_maps.values() if rid in m]
                sid = candidates[0] if candidates else None
            if sid and sid not in output:
                output.append(sid)
        return output

    @staticmethod
    def form_id(space, raw):
        id = slug(raw)
        return id if id.startswith(space + '_') else space + '_' + id

    @staticmethod
    def owner(value):
        v = str(value or 'applicant').lower()
        if any(t in v for t in ['consultant', 'ministry', 'office', 'reviewer', 'finance', 'manager approval']):
            return 'Ministry'
        if v in {'applicant', 'licensee', 'provider', 'board', 'board chair', 'calculated estimate'}:
            return 'Applicant'
        return 'External'

    def bind(self, f, section, raw, column=False):
        if column:
            return None
        # Supplier, municipality, survey-organizer and organization mailing details can
        # differ from the care-site profile. Retain independent source fields.
        form_id = f.get('sourceInventoryId')
        if form_id in {'direct_deposit', 'municipal_eoi', 'survey_need'}:
            return None
        key, label = slug(raw.get('id')), raw.get('label', '').lower()
        # Never reuse applicant identity for household, bank, staff, references or an unrelated contact.
        if any(w in section['id'] for w in ['reference', 'household', 'bank', 'staff', 'employee', 'parent', 'signature', 'office']):
            if f['sourceInventoryId'] not in {'parent_handbook'}:
                return None
        if raw.get('owner') and self.owner(raw['owner']) != 'Applicant':
            return None
        if key in {'first_name'}:
            return 'profile.firstName'
        if key in {'last_name'}:
            return 'profile.lastName'
        if key in {'contact_name'}:
            return 'profile.contactName'
        if key in {'email', 'email_address'}:
            return 'profile.email'
        if key in {'daytime_phone', 'phone', 'phone_number', 'telephone', 'telephone_number'}:
            return 'profile.phone'
        # Mailing address can differ from the care location; never bind it to the physical address.
        if key in {'street_address', 'site_physical_address', 'street', 'address'}:
            return 'profile.address'
        if form_id == 'community_needs_assessment' and key in {'city_town', 'postal_code', 'mailing_address'}:
            return None
        if key in {'city_town', 'city'}:
            return 'profile.city'
        if key in {'postal_code', 'postal'}:
            return 'profile.postalCode'
        if key in {'facility_name', 'site_name_if_different', 'centre_name'}:
            return 'profile.facilityName'
        if key in {'name_of_organization', 'incorporated_name', 'organization_name'}:
            return 'profile.organizationName'
        if key == 'projected_opening_or_change_effective_date':
            return 'profile.openingDate'
        if key == 'name' and f['sourceInventoryId'] == 'parent_handbook' and 'centre' in f['types']:
            return 'profile.facilityName'
        return None

    def field(self, raw, f, section, parent_owner, column=False):
        rawid = slug(raw.get('id') or raw.get('label'))
        fid = rawid if column else section['id'] + '_' + rawid
        t = raw.get('type', 'text')
        req = raw.get('requirement', {})
        if isinstance(req, str):
            req = {'status': req}
        status = req.get('status') or raw.get('requiredness') or 'unknown'
        explicit = status in {'required', 'explicit_required_for_this_form_when_applicable'}
        owner = self.owner(raw.get('owner', parent_owner))
        is_signature = t == 'signature' or ('signature' in rawid and t != 'date')
        calculated = t == 'calculated' or raw.get('officialSeparateEntryField') is False
        type_map = {
            'text': 'text', 'textarea': 'textarea', 'currency': 'number', 'integer': 'number', 'number': 'number',
            'date': 'date', 'email': 'email', 'select': 'select', 'single_choice': 'select', 'yes_no': 'select',
            'boolean': 'checkbox', 'checkbox': 'checkbox', 'acknowledgment': 'checkbox', 'acknowledgement': 'checkbox',
            'multiple_choice': 'checkbox_group', 'checkbox_group': 'checkbox_group', 'time': 'text',
            'repeat_group': 'table', 'table': 'table', 'matrix': 'table', 'signature': 'text', 'calculated': 'calculated',
            'attachment': 'text', 'external_document': 'text',
        }
        item = {'id': fid, 'label': raw.get('label') or raw.get('title') or rawid.replace('_', ' ').title(),
                'type': type_map.get(t, 'text'), 'required': bool(explicit and owner == 'Applicant' and not is_signature and not calculated),
                'aiAllowed': False, 'originalFieldId': raw.get('id'), 'originalType': t,
                'sourcePage': raw.get('sourcePage') or section.get('sourcePage')}
        help_parts = notes(raw.get('help'), raw.get('note'), raw.get('versionCaution'))
        original_condition = raw.get('condition') or raw.get('requiredIf') or req.get('condition')
        if original_condition:
            item['originalCondition'] = original_condition
            help_parts.append('Applies when: ' + str(original_condition))
        if status in {'unknown', 'present_on_form_not_individually_marked_required'}:
            help_parts.append('Requested field; applicability checked by reviewer. The source does not mark this field individually mandatory.')
            item['completenessReview'] = True
        elif status in {'conditional', 'conditional_or_optional'}:
            item['completenessReview'] = True
            item['required'] = False  # A narrative condition is not a safe executable predicate.
        item['originalRequirement'] = clean(req or {'status': status})
        if owner != 'Applicant':
            item['required'] = False
            if owner == 'External':
                item['readonly'] = True
            item['sourceOwner'] = owner
            help_parts.append('Completed by ' + ('the Ministry' if owner == 'Ministry' else 'the named third party') + '; not an applicant entry.')
        if is_signature:
            item['label'] = item['label'] + ' — prepared signer name'
            item['type'], item['required'], item['aiAllowed'] = 'text', False, False
            item['signatureMetadata'] = {'originalLabel': raw.get('label'), 'originalRequirement': clean(req or status),
                                         'owner': owner, 'electronicSignature': False}
            help_parts.append('Print / authorized signing needed. Entering a prepared signer name is not an electronic signature and does not complete the official signature requirement.')
        if calculated:
            item['type'], item['readonly'], item['required'] = 'calculated', True, False
            item['calculationMetadata'] = {'sourceDeclaredCalculation': True, 'formulaImplemented': False}
            if raw.get('derivedFrom'):
                item['calculationMetadata']['sourceAmounts'] = raw['derivedFrom']
            help_parts.append('Source calculated estimate. No formula or grant award is inferred here; use the verified source workbook or Ministry determination.')
        if column and f['sourceInventoryId'] == 'home_licence_application' and section['id'] == 'references' and rawid in {'full_name', 'street_address', 'city_town', 'province', 'postal_code'}:
            item['required'] = True
            item['originalRequirement'] = {'status': 'explicit', 'basis': 'Application expressly requests names and addresses of four character references.'}
            item.pop('completenessReview', None)
        if t in {'attachment', 'external_document'}:
            item['proposedWorkflowField'] = True
            item['originalAttachmentRequirement'] = raw.get('label')
            item['label'] += ' — attachment reference'
            item['required'] = False
            help_parts.append('Proposed preparation field: identify the authentic attachment. This text does not create or validate the document.')
        if t == 'currency':
            item['format'] = 'currency'
        if t == 'time':
            item['inputHint'] = 'time'
        if t == 'yes_no' and not raw.get('options'):
            raw = dict(raw, options=['Yes', 'No'])
        if raw.get('options'):
            opts = []
            for o in raw['options']:
                if isinstance(o, dict):
                    opts.append({'value': o.get('value', o.get('label', '')), 'label': o.get('label', o.get('value', '')),
                                 **({'sourceMaximum': o['maximum']} if 'maximum' in o else {})})
                else:
                    opts.append({'value': str(o), 'label': str(o)})
            item['options'] = opts
        # Only explanatory operating-policy drafts permit AI assistance; never personal/health/background input.
        ai = raw.get('aiAssistance', {}).get('enabledByDefault')
        safe_policy = f['sourceInventoryId'] in {'parent_handbook'} and t == 'textarea'
        if owner == 'Applicant' and safe_policy and ai is not False:
            item['aiAllowed'] = True
        if item['type'] == 'table':
            children = raw.get('fields') or raw.get('columns') or []
            if t == 'matrix':
                columns = [{'id': 'row_label', 'label': 'Meal', 'type': 'text', 'required': False,
                            'readonly': True, 'aiAllowed': False}]
                columns += [{'id': slug(day), 'label': str(day), 'type': raw.get('cellType', 'textarea'),
                             'required': False, 'aiAllowed': False, 'completenessReview': True} for day in raw.get('columns', [])]
                item['columns'] = columns
                item['fixedRows'] = [{'row_label': str(row)} for row in raw.get('rows', [])]
                item['minRows'] = len(item['fixedRows'])
                item['allowAddRows'] = False
            else:
                item['columns'] = [self.field(c if isinstance(c, dict) else {'id': slug(c), 'label': c}, f, section, parent_owner, True) for c in children]
                for c in item['columns']:
                    c.pop('bind', None)
                    if c['type'] == 'table':
                        raise ValueError('Nested table needs explicit mapping: ' + f['id'] + '/' + fid)
                item['minRows'] = raw.get('minItems', raw.get('minRows', 0))
                if raw.get('maxItems'):
                    item['maxRows'] = raw['maxItems']
                if raw.get('printedRows'):
                    item['sourcePrintedRows'] = raw['printedRows']
                if raw.get('allowAdditionalSheets'):
                    item['allowAddRows'] = True
        bind = self.bind(f, section, raw, column)
        if bind and owner == 'Applicant' and not is_signature:
            item['bind'] = bind
        # Known source applicability predicates; never translate vague prose to a guessed hard stop.
        formraw = f['sourceInventoryId']
        if formraw == 'home_licence_application' and rawid in {'mailing_street_box', 'mailing_city_town', 'mailing_postal_code'}:
            item['when'] = [{'field': 'applicant_mailing_same', 'equals': False}]
            help_parts.append('Complete only when the mailing address differs from the street address.')
        if formraw == 'community_needs_assessment':
            if 'existing_centre_expansion' in section['id']:
                item['when'] = [condition('applicationKind', 'expand')]
            elif 'new_centre_spaces' in section['id']:
                item['when'] = [condition('applicationKind', 'new')]
        if formraw == 'centre_licence_application':
            if rawid.startswith('private_owner'):
                item['when'] = [condition('organizationType', PRIVATE)]
            elif rawid.startswith('board_chair'):
                item['when'] = [condition('organizationType', ['nonprofit', 'cooperative'])]
        if help_parts:
            item['help'] = ' '.join(help_parts)
        return item

    def sections(self, raw_sections, f):
        output = []
        used = set()
        for ix, s in enumerate(raw_sections or []):
            if not isinstance(s, dict):
                continue
            base = slug(s.get('id') or s.get('title') or s.get('label') or 'section_' + str(ix + 1))
            if base in used:
                base += '_' + str(ix + 1)
            used.add(base)
            groups = {}
            section_owner = s.get('owner', 'Applicant')
            for raw in s.get('fields', []):
                if not isinstance(raw, dict):
                    continue
                owner = self.owner(raw.get('owner', section_owner))
                groups.setdefault(owner, []).append(raw)
            for owner, fields in groups.items():
                sid = base + ('_' + owner.lower() if len(groups) > 1 else '')
                sec = {'id': sid, 'title': s.get('title') or s.get('label') or base.replace('_', ' ').title(),
                       'owner': owner, 'sourcePage': s.get('page') or s.get('sourcePage'), 'fields': []}
                if s.get('instructions'):
                    sec['help'] = s['instructions']
                if s.get('condition'):
                    sec['originalCondition'] = s['condition']
                if s.get('repeatable'):
                    table = {'id': 'rows', 'label': sec['title'], 'type': 'table', 'fields': fields,
                             'owner': section_owner, 'requiredness': 'unknown'}
                    sec['fields'].append(self.field(table, f, sec, owner))
                else:
                    for raw in fields:
                        sec['fields'].append(self.field(raw, f, sec, owner))
                        if raw.get('companionField'):
                            companion = dict(raw['companionField'], owner=raw.get('owner', section_owner))
                            companion['label'] += ' — ' + raw.get('label', '')
                            sec['fields'].append(self.field(companion, f, sec, owner))
                output.append(sec)
        return output

    def review_ack(self, f):
        if not any(s['owner'] == 'Applicant' for s in f['sections']):
            return
        f['sections'].append({'id': 'preparation_review', 'title': 'Review this prepared form', 'owner': 'Applicant',
            'proposedWorkflowSection': True, 'fields': [{
                'id': 'preparation_review_relevant_fields_reviewed', 'label': 'I reviewed all relevant requested fields and identified any not-applicable answers, missing documents and required signatures.',
                'type': 'checkbox', 'required': True, 'aiAllowed': False, 'proposedWorkflowField': True,
                'help': 'Proposed local preparation acknowledgment, not a question on the official form. It does not certify eligibility, replace a signature or indicate Ministry acceptance.'}]})

    def add(self, f, inventory_space=None, raw=None):
        if f['id'] in self.ids:
            raise ValueError('Duplicate form ID: ' + f['id'])
        self.ids.add(f['id'])
        self.forms.append(f)
        if inventory_space:
            self.coverage.append({'inventory': inventory_space, 'sourceId': raw['id'], 'catalogId': f['id'],
                                  'status': 'unavailable' if f['kind'] == 'unavailable' else 'converted', 'phase': f['phase']})

    def home_forms(self):
        required = {'home_licence_application', 'family_assessment', 'direct_deposit', 'parent_handbook',
                    'weekly_menu', 'information_release', 'self_assessment', 'change_information', 'expansion_assessment'}
        for raw in self.home['forms']:
            rid = raw['id']
            phase = {'initial_application': 'intake', 'pre_licensing': 'preopening', 'screening': 'review',
                     'existing_home_change': 'intake', 'optional_funding': 'optional'}.get(raw['stage'], 'preopening')
            f = {'id': self.form_id('home', rid), 'title': raw['title'], 'types': HOME_TYPES[:],
                 'phase': phase, 'kind': 'external' if rid == 'reference_questionnaire' else 'form',
                 'required': rid in required, 'sourceInventoryId': rid,
                 'sourceIds': self.source_ids('home', raw['sourceIds']), 'sections': [],
                 'originalRequirement': clean(raw.get('requiredIf') or raw.get('classification')),
                 'originalSubmission': clean(raw.get('submission')),
                 'notes': notes(raw.get('instructions'), raw.get('eligibility'), raw.get('paymentTiming'), raw.get('versionCaution'), raw.get('versionConflicts'))}
            if raw['stage'] == 'initial_application':
                f['when'] = [condition('applicationKind', 'new')]
            elif raw['stage'] == 'existing_home_change':
                f['when'] = [condition('applicationKind', 'expand')]
            if rid == 'expansion_assessment':
                f['types'] = ['group_home']
                f['notes'].append('For conversion from an existing family licence to group or group expansion beyond 12. Existing groups seeking above 12 need two years on a regular licence and Ministry approval.')
            if rid == 'reference_questionnaire':
                f['notes'].append('Independent reference evidence. Applicant provides contacts; the reference and consultant complete their own fields.')
            if rid == 'parent_handbook':
                f['originalRequirement'] = 'required_operational_document_and_required_ministry_template'
                f['notes'].append('Use the Ministry’s home Parent Handbook template. The companion information sheet expressly requires this template; add sections relevant to your home and give a copy to each family.')
            if phase == 'optional':
                f['required'] = False
            f['sections'] = self.sections(raw['sections'], f)
            if raw.get('attachments'):
                f['attachmentRequirements'] = clean(raw['attachments'])
            if raw.get('signatures'):
                f['originalSignatureInstructions'] = clean(raw['signatures'])
            self.review_ack(f)
            self.add(f, 'home', raw)

    def centre_forms(self):
        for raw in self.centre['forms']:
            rid = raw['id']
            optional = raw.get('scope') == 'optional_funding_or_operations' or raw.get('stage') in {'funding', 'operating'}
            if rid in {'direct_deposit'}:
                optional = False
            phase = 'optional' if optional else {'readiness': 'intake', 'application': 'preopening',
                      'premises': 'preopening', 'funding': 'preopening', 'final_review': 'review'}.get(raw.get('stage'), 'preopening')
            if rid in {'survey_need', 'municipal_eoi', 'confidentiality_oath', 'ece_training_exemption'}:
                phase = 'optional'
            f = {'id': self.form_id('centre', rid), 'title': raw['title'], 'types': CENTRE_TYPES[:],
                 'phase': phase, 'kind': 'task' if raw.get('kind') == 'checklist' else 'form',
                 'required': raw.get('requiredness') == 'required' and phase != 'optional',
                 'sourceIds': self.source_ids('centre', raw.get('sourceIds', [])), 'sections': [],
                 'sourceInventoryId': rid, 'originalRequirement': raw.get('requiredness'),
                 'originalCondition': raw.get('condition'), 'originalSubmission': clean(raw.get('submission')),
                 'notes': notes(raw.get('notes'), raw.get('currentPolicyCaveat'), raw.get('implementation'))}
            if rid in {'community_needs_assessment', 'centre_budget_template'}:
                f['when'] = [condition('centrePathway', 'centre-development')]
            if rid == 'centre_budget_template':
                f['required'] = False
                f['notes'].append('Development and projected operating budgets are required for development intake, but using this particular workbook is optional. The separate budget-evidence item records prepared budgets. Calculated grant estimates are not awards.')
            if rid == 'direct_deposit':
                f['required'], f['phase'] = True, 'preopening'
                f['when'] = [condition('organizationType', FUNDED), condition('requestingFunding', [True])]
            if rid == 'bylaws_template':
                f['when'] = [condition('organizationType', ['nonprofit', 'cooperative'])]
            if rid == 'municipal_eoi':
                f['when'] = [condition('organizationType', ['municipality'])]
            if rid in {'parent_handbook', 'menu_plan'}:
                f['required'], f['phase'] = True, 'preopening'
            # A summary-only section is not a verified digital form.
            actual = [s for s in raw.get('sections', []) if isinstance(s, dict) and s.get('fields')]
            if rid == 'survey_need':
                # Source p1 identifies the respondent before asking about their care needs.
                # Only the geographic survey area and organizer return details belong to the applicant.
                actual = json.loads(json.dumps(actual))
                for survey_section in actual:
                    if survey_section.get('title') == 'Survey location and respondent':
                        for survey_field in survey_section['fields']:
                            survey_field['owner'] = 'Applicant' if survey_field['id'] == 'area_to_be_surveyed' else 'Prospective parent'
                    elif survey_section.get('title') == 'Need and current arrangements':
                        survey_section['owner'] = 'Prospective parent'
                f['notes'].append('Survey respondents supply their own identity and childcare needs. Organizer details are separate and are never copied into respondent fields.')
            if not actual:
                f['kind'] = 'unavailable' if raw.get('kind') != 'checklist' else 'task'
                f['notes'].append('No field-level digital form was verified in this inventory. Use the linked source or request the current form; no official questions are invented.')
            f['sections'] = self.sections(actual + [r for r in raw.get('reviewerFields', []) if isinstance(r, dict) and r.get('fields')], f)
            if raw.get('attachments'):
                f['attachmentRequirements'] = clean(raw['attachments'])
            if f['kind'] == 'form':
                self.review_ack(f)
            self.add(f, 'centre', raw)

    def evidence(self, space, raw, required=None, phase='preopening', when=None, kind='external'):
        rid = raw['id']
        if self.form_id(space, rid) in self.ids:
            return
        f = {'id': self.form_id(space, rid), 'title': raw['title'], 'types': HOME_TYPES[:] if space == 'home' else CENTRE_TYPES[:],
             'phase': phase, 'kind': kind, 'required': bool(required if required is not None else raw.get('requiredness') == 'required'),
             'sourceInventoryId': rid, 'sourceIds': self.source_ids(space, raw.get('sourceIds', [])),
             'originalRequirement': clean(raw.get('requirement') or raw.get('requiredFor') or raw.get('requiredness')),
             'originalSubmission': clean(raw.get('originalHandling')),
             'notes': notes(raw.get('condition'), raw.get('issuer'), raw.get('originalHandling'), raw.get('handling'), raw.get('digitalAction')),
             'sections': []}
        if when:
            f['when'] = when
        tracking = [
            {'id': 'preparation_status', 'label': 'Preparation status', 'type': 'select', 'required': False, 'aiAllowed': False,
             'options': [{'value': x, 'label': x} for x in ['Not started', 'Requested', 'Booked', 'Received', 'Delivered', 'Needs follow-up', 'Not applicable']],
             'proposedWorkflowField': True},
            {'id': 'preparation_booking_or_request_date', 'label': 'Booking / request date', 'type': 'date', 'required': False, 'aiAllowed': False, 'proposedWorkflowField': True},
            {'id': 'preparation_issuer', 'label': 'Issuer / service contact', 'type': 'text', 'required': False, 'aiAllowed': False, 'proposedWorkflowField': True},
            {'id': 'preparation_document_date', 'label': 'Document / completion date', 'type': 'date', 'required': False, 'aiAllowed': False, 'proposedWorkflowField': True},
            {'id': 'preparation_document_reference', 'label': 'Document reference or filename', 'type': 'text', 'required': False, 'aiAllowed': False, 'proposedWorkflowField': True},
            {'id': 'preparation_delivery_method', 'label': 'Delivery method / original-document arrangements', 'type': 'textarea', 'required': False, 'aiAllowed': False, 'proposedWorkflowField': True},
        ]
        f['sections'] = [
            {'id': 'preparation', 'title': 'Preparation tracking — proposed local fields', 'owner': 'Applicant',
             'help': 'These fields track an authentic document or task. They are not official form questions and do not certify compliance.', 'fields': tracking},
            {'id': 'staff_verification', 'title': 'Ministry verification', 'owner': 'Ministry', 'fields': [
                {'id': 'staff_verification_authenticity_and_requirements', 'label': 'Verify authentic evidence and applicable requirements', 'type': 'textarea',
                 'required': False, 'aiAllowed': False, 'proposedWorkflowField': True,
                 'help': 'Staff-only verification. No applicant self-approval and no automated suitability judgment.'}]}]
        self.review_ack(f)
        self.add(f, space + '_evidence', raw)

    def unavailable(self, space, raw):
        rid = raw['id']
        if self.form_id(space, rid) in self.ids:
            return
        if space == 'home' and rid == 'fee_schedule':
            self.evidence('home', {'id': rid, 'title': raw['title'], 'sourceIds': raw.get('sourceIds', []),
                'condition': 'A provider-authored written fee schedule is required. No mandatory standalone official blank was found. Draft it in the parent-handbook Fee Schedule and Payment section or attach your own schedule; confirm applicable fee limits and Ministry approval.'}, True, 'preopening')
            self.coverage.append({'inventory': 'home_unavailable', 'sourceId': rid,
                                  'catalogId': self.form_id('home', rid), 'status': 'converted_provider_document', 'phase': 'preopening'})
            return
        optional = raw.get('scope') == 'optional_funding_or_operations' or raw.get('stage') == 'funding' or rid == 'grant_decline'
        f = {'id': self.form_id(space, rid), 'title': raw['title'], 'types': HOME_TYPES[:] if space == 'home' else CENTRE_TYPES[:],
             'phase': 'optional' if optional else 'preopening', 'kind': 'unavailable',
             'required': not optional and (raw.get('requiredness') == 'required' or rid in {'learning_plans', 'criminal_information_disclosure_consent', 'fee_schedule'}),
             'sourceIds': self.source_ids(space, raw.get('sourceIds', ['opening-checklist'] if space == 'centre' else [])),
             'sections': [], 'sourceInventoryId': rid,
             'originalRequirement': raw.get('requirement') or raw.get('requiredness'),
             'notes': notes(raw.get('availability'), raw.get('handling'), raw.get('digitalAction'), raw.get('notes'),
                            'The current official questions were not publicly verified. Request the genuine form from the consultant; a local status cannot replace it.'),
             'availability': 'consultant_or_external_document_needed'}
        if rid == 'alternate_outdoor_play_plan':
            f['required'] = True
            f['when'] = [condition('alternateOutdoorPlanNeeded', [True])]
        if rid == 'developmental_licence_application':
            f['when'] = [condition('centrePathway', 'centre-development')]
        if rid == 'capital_agreement':
            f['when'] = [condition('organizationType', FUNDED), condition('requestingFunding', [True])]
        if rid == 'licensing_checklist':
            f['phase'] = 'review'
        if rid == 'inspection_templates':
            f['required'] = False
            f['notes'].append('Actual fire/heating evidence is tracked separately. No additional universal blank inspection form is implied.')
        self.add(f, space + '_unavailable', raw)

    def external_and_tasks(self):
        for raw in self.home.get('externalIssuedEvidence', []):
            rid = raw['id']
            required = rid in {'criminal_checks_originals', 'fire_report', 'heating_report', 'insurance', 'first_aid_cpr', 'ece'}
            phase, when = 'preopening', None
            if rid in {'criminal_checks_originals', 'void_cheque'}:
                phase = 'intake'
                when = [condition('applicationKind', 'new')]
            if rid in {'phase1_workshop_certificate', 'written_estimates'}:
                phase = 'optional'
            if rid == 'municipal_approvals':
                required = False
            self.evidence('home', raw, required, phase, when)
        for raw in self.centre.get('externalEvidence', []):
            rid, when = raw['id'], None
            required = raw.get('requiredness') == 'required'
            if rid == 'incorporation':
                when, required = [condition('organizationType', CORPORATE)], True
            elif rid == 'lease':
                when, required = [condition('premisesTenure', 'rented')], True
            elif rid == 'private_operator_check':
                when, required = [condition('organizationType', PRIVATE)], True
            elif rid == 'private_operator_health':
                when, required = [condition('organizationType', PRIVATE), condition('ministryRequestedMedical', [True])], True
            elif rid == 'audited_financials':
                when, required = [condition('ministryRequestedFinancials', [True])], True
            self.evidence('centre', raw, required, 'preopening', when)
        for raw in self.home.get('notPublicOrNoStandardFormLocated', []):
            self.unavailable('home', raw)
        for raw in self.centre.get('unavailableForms', []):
            self.unavailable('centre', raw)
        self.evidence('home', {'id': 'applicant_information_session', 'title': 'Complete the home applicant information session',
            'sourceIds': ['apply-page', 'faq'], 'condition': 'Complete the published online session before submitting a new application.'},
            True, 'intake', [condition('applicationKind', 'new')], 'task')
        self.evidence('centre', {'id': 'development_information_session', 'title': 'Complete the centre development information session',
            'sourceIds': ['centre-apply', 'opening-checklist'], 'condition': 'Published development intake requires this session.'},
            True, 'intake', [condition('centrePathway', 'centre-development')], 'task')
        self.evidence('centre', {'id': 'licensing_only_route_confirmation', 'title': 'Confirm the private licensing intake with the consultant',
            'sourceIds': ['centre-apply', 'licensing-manual'], 'condition': 'Private licensing is permitted, but the public page primarily describes funded development. Ask the consultant which intake and supporting documents apply; funding eligibility is separate.'},
            True, 'intake', [condition('centrePathway', 'licensing-only')], 'task')
        self.evidence('centre', {'id': 'development_and_operating_budgets', 'title': 'Provide development and projected operating budgets',
            'sourceIds': ['centre-apply', 'cna'], 'condition': 'Required supporting budgets for development intake. Use the verified workbook or your own prepared budgets; the workbook itself is optional.'},
            True, 'intake', [condition('centrePathway', 'centre-development')])

        self.evidence('home', {'id': 'group_assistant_credentials', 'title': 'Group-home assistant checks, training and staff records',
            'sourceIds': ['regulations', 'group-update', 'self-assessment'],
            'condition': 'For group homes: assistant must be at least 18, have required criminal/vulnerable-sector checks, orientation, first aid/CPR and staff records. Timing follows applicable current requirements; assistant required whenever family-home number/age limits are exceeded.'},
            True, 'preopening')
        self.forms[-1]['types'] = ['group_home']

    def process_data(self, space, value):
        if isinstance(value, list):
            return [self.process_data(space, v) for v in value]
        if not isinstance(value, dict):
            return clean(value)
        result = {}
        for key, val in value.items():
            if key == 'sourceIds':
                result[key] = self.source_ids(space, val)
            elif key in {'forms', 'initialForms', 'conditionalForms', 'externalEvidence'} and isinstance(val, list):
                result[key] = [self.form_id(space, x) if isinstance(x, str) else self.process_data(space, x) for x in val]
            else:
                result[key] = self.process_data(space, val)
        return result

    def funding_coverage(self):
        # Centre research already includes the verified funding forms. Do not duplicate them.
        for raw in self.funding.get('forms', []):
            target = self.form_id('centre', raw['id'])
            match = next((x for x in self.forms if x['id'] == target), None)
            if match:
                self.coverage.append({'inventory': 'funding', 'sourceId': raw['id'], 'catalogId': target,
                                      'status': 'unavailable' if match['kind'] == 'unavailable' else 'converted', 'phase': 'optional'})
                continue
            # Descriptive sections and an applicantFields list are not enough to invent controls.
            mapped = [s for s in raw.get('sections', []) if isinstance(s, dict) and s.get('fields')]
            f = {'id': target, 'title': raw['title'], 'types': CENTRE_TYPES[:], 'phase': 'optional',
                 'kind': 'form' if mapped else 'unavailable', 'required': False,
                 'sourceInventoryId': raw['id'], 'sourceIds': self.source_ids('funding', raw.get('sourceIds', [])),
                 'sections': [], 'originalRequirement': raw.get('conditions'), 'originalSubmission': clean(raw.get('submission')),
                 'notes': notes(raw.get('verification'), raw.get('implementation'), raw.get('conditions'))}
            if mapped:
                f['sections'] = self.sections(mapped, f)
                self.review_ack(f)
            else:
                f['notes'].append('Programme description only; complete official field inventory not verified. Request the current form instead of inventing questions.')
            self.add(f, 'funding', raw)

    def readable_help(self):
        """Convert terse research notes to plain help without changing official fields."""
        section_help = {
            ('home_licence_application', 'household'): 'List everyone living in the home, including children, your spouse, relatives and other residents. You may attach another sheet. Include original criminal record and vulnerable sector checks for yourself and every resident aged 18 or older, each in a separate sealed envelope.',
            ('home_licence_application', 'route'): 'New family homes may apply for up to eight children. New group homes may initially apply for up to 12 spaces. An existing group home can seek approval for up to 16 after meeting the additional expansion requirements.',
            ('home_licence_application', 'references'): 'Provide four character references. Parents, siblings and children cannot be references; no more than one reference may be an extended family member. The Ministry may contact other people for references.',
            ('direct_deposit', 'bank_evidence'): 'Option A is preferred unless the account does not support cheques. Attach a void cheque or bank-generated document showing the account holder’s name, address, bank, branch and account details. If using Option B, your financial institution must complete, sign and stamp that section.',
            ('direct_deposit', 'office'): 'The Ministry verifies the supplier’s phone number and contacts the supplier to confirm the payment request.',
            ('information_release', 'consent'): 'Choose whether your contact details may be shared with the other people or groups listed on the form. Separately, the Ministry shares these details with parents seeking care unless you explicitly ask it not to.',
            ('fire_health_safety_grant', 'costs'): 'You may request up to $2,400. Attach written estimates, including taxes, for every item. Obtain your consultant’s approval before making purchases.',
            ('startup_grant', 'category'): 'Choose Teen Student Support only if that is the licence designation arranged with your consultant. Northern rates apply to eligible homes in the Northern Administration District.',
            ('startup_grant', 'equipment'): 'At least 50% of the grant must be used for equipment and programming.',
            ('startup_grant', 'fire_safety'): 'Up to 50% of the grant may cover fire, health and safety costs beyond the separate $2,400 Fire, Health and Safety Grant.',
            ('nutrition_grant', 'agreement'): 'Attach a menu covering the meals and snacks served during your operating hours. Your consultant will confirm the monthly grant amount you are eligible to receive.',
            ('active_play_plan', 'items'): 'List the proposed purchases, their estimated costs including taxes, and how they will support active play. The official table continues on page 2.',
            ('play_exploration_plan', 'social_emotional'): 'A purchase can support more than one area of development. Explain its contribution in each relevant area and count the purchase cost only once in your total.',
            ('play_exploration_plan', 'physical'): 'A purchase can support more than one area of development. Explain its contribution in each relevant area and count the purchase cost only once in your total.',
            ('play_exploration_plan', 'intellectual'): 'A purchase can support more than one area of development. Explain its contribution in each relevant area and count the purchase cost only once in your total.',
            ('play_exploration_plan', 'spiritual'): 'A purchase can support more than one area of development. Explain its contribution in each relevant area and count the purchase cost only once in your total.',
            ('weekly_menu', 'weekly_meals'): 'Check the official Menu Requirements Backgrounder for food combinations, drinks and age-specific needs. Complete the meals and snacks served during your operating hours.',
            ('expansion_assessment', 'rationale'): 'Explain local demand, waiting lists, community growth and any shortage of licensed spaces. Expansion requests are considered in areas where the Ministry has identified a need.',
            ('expansion_assessment', 'municipal'): 'Include the municipal documents that apply, such as building permits, land-use or zoning approvals, parking requirements and outdoor play requirements.',
            ('expansion_assessment', 'indoor'): 'Explain how the home will provide at least 3.7 square metres of usable floor area per child. Attach a floor plan or detailed drawing, measurements and washroom information. The official form says applications missing this information will be rejected.',
            ('expansion_assessment', 'staffing'): 'Explain your staffing arrangements and how you will cover an assistant’s illness, appointments, vacation and other absences.',
        }
        replacements = {
            'resident18+': 'resident aged 18 or older',
            'beyond12': 'beyond 12',
            'above12': 'above 12',
            'section22': 'section 22',
            'Use holistic domains from Play and Exploration guide pp25–27.': 'Use the areas of development described on pages 25–27 of the Play and Exploration guide.',
            'Old printed Ministry Learning branding and Rev08/03, but current opening catalogue still lists it.': 'The current opening-home catalogue still lists this form, although its printed revision is August 2003.',
            'Printed40-hour course text is stale; current regulation61 requires45-hour introductory course or approved equivalent within1year, groupECEIwithin3years.': 'The form still mentions a 40-hour course. Current requirements are a 45-hour introductory ECE course or approved equivalent within one year; group-home providers must obtain ECE I within three years.',
            'Initialapplicationrequiresapplicant/adultresident originals, each in separate sealed envelope. Localupload/scan is a preparationrecord only, not substitute.': 'Include the original checks for the applicant and each adult resident in separate sealed envelopes. A local upload or scan does not replace these originals.',
            'No universal provincewide publicblankhome fire/heating report located. Reportmustbeissuedbyqualifiedauthority.': 'No single public blank report was found for all home fire and heating inspections. Obtain the report from the qualified inspector or authority.',
            'Track booking,issuer,date,reportfile,deficiencies,remediation; applicantcannotselfcertifyinspectionpass.': 'Record the booking, inspector, report date, document and any work still needed. The inspector provides the findings; the Ministry reviews them.',
            'Standaloneconsultantdeclineformnotlocated.': 'Ask your consultant for the separate grant-decline form if needed.',
            'Allowdeclinewithoutblockinglicence; useactualgrantformdeclinefieldwherepresent.': 'You may decline a grant without making your licence application incomplete. Use the decline section on the grant form where available.',
        }
        def rewrite(value):
            if isinstance(value, str):
                for old, new in replacements.items():
                    value = value.replace(old, new)
                return value
            if isinstance(value, list):
                return [rewrite(v) for v in value]
            return value
        for form in self.forms:
            rawid = form.get('sourceInventoryId')
            for section in form['sections']:
                section_id = re.sub(r'_(applicant|external|ministry)$', '', section['id'])
                key = (rawid, section_id)
                if key in section_help and 'family_home' in form['types']:
                    section['help'] = section_help[key]
                elif section.get('help'):
                    section['help'] = rewrite(section['help'])
                for field in section['fields']:
                    for name in ['label', 'help', 'originalCondition']:
                        if name in field:
                            field[name] = rewrite(field[name])
            form['notes'] = rewrite(form.get('notes', []))
            if rawid == 'self_assessment':
                form['notes'] = [
                    'Return this checklist to your consultant before the licensing or annual review meeting. Choose Yes, No or Not applicable and add any requested details in Comments. Monthly self-checks are recommended; annual professional-development questions apply only to the annual review.',
                    'Some printed wording is older than the current rules. In particular, use the current ECE training requirements and the 2026 injury-reporting and attendance requirements. The linked current regulations take precedence.'
                ]

    def budget_mapping(self):
        """Map verified workbook cells without executing its obsolete grant rates.

        Operating totals are a transparent preparation aid. They include all entered
        line items, correcting the source workbook's omitted Other/Food rows.
        """
        form = next(f for f in self.forms if f['sourceInventoryId'] == 'centre_budget_template')
        sections = {s['id']: s for s in form['sections']}
        inputs = sections['input_to_calculate_annual_grant']
        assert len(inputs['fields']) == 40
        for row, field in enumerate(inputs['fields'], 6):
            field.update(sourceSheet='Input to Calculate Annual Grant', sourceCell=f'C{row}')
        inputs['help'] = 'These are the inputs requested by the source workbook. Grant estimates are not calculated here because the workbook contains rates that may no longer apply. Confirm current amounts with the Ministry.'
        grants = sections['annual_grants']
        grant_rows = [4, 5, *range(8, 31), 33, 34, 37]
        assert len(grants['fields']) == len(grant_rows)
        for row, field in zip(grant_rows, grants['fields']):
            field.update(sourceSheet='Annual Grants', sourceCell=f'B{row}')
            field['calculationMetadata'] = {'sourceDeclaredCalculation': True, 'formulaImplemented': False,
                                          'reason': 'Source grant rates are not current-policy determinations.'}
            field['help'] = 'The source workbook calculates this grant estimate. This draft leaves it uncalculated; confirm current eligibility and rates with the Ministry.'
            if row == 30:
                field['help'] += ' The source repeats the ECE II label here although its formula refers to ECE III inputs; ask the Ministry to confirm this line.'
        grants['help'] = 'Grant estimates are not calculated in this draft. The published workbook includes older rates; it does not establish an award or current entitlement.'

        section = sections['annual_operating_budget']
        prefix = 'annual_operating_budget_'
        field_rows = [4, 5, 6, *range(11, 17), *range(20, 27), *range(30, 36),
                      *range(39, 43), *range(46, 54), *range(57, 62)]
        fields = [f for f in section['fields'] if f['id'].endswith('_monthly') or re.search(r'_monthly_\d+$', f['id'])]
        assert len(fields) == len(field_rows) == 39
        categories = [(range(4, 7), 'revenue', 'Revenue'), (range(11, 17), 'staffing', 'Staffing'),
                      (range(20, 27), 'administration', 'Administration'), (range(30, 36), 'premises', 'Premises'),
                      (range(39, 43), 'professional_development', 'Professional development'),
                      (range(46, 54), 'consumables', 'Consumables'), (range(57, 62), 'equipment', 'Equipment')]
        for row, field in zip(field_rows, fields):
            category, title = next((key, title) for rows, key, title in categories if row in rows)
            field.update(sourceSheet='Budget ', sourceCell=f'B{row}', budgetPeriod='monthly',
                         budgetRole='revenue' if row < 7 else 'expense', budgetCategory=category)
            field['originalLabel'] = field['label']
            if field['originalFieldId'] == 'other_monthly':
                field['label'] = f'Other {title.lower()} costs — monthly'
            if row in range(39, 43):
                field['help'] += ' Enter the monthly amount here and its annual amount in the separate annual professional-development field. The annual total uses the annual entry, not this amount multiplied by 12.'
            if row == 4:
                field['help'] = 'Enter the monthly facility-fee revenue confirmed for your budget. Count each revenue source once: if a Parent Fee Reduction Grant amount is included here, exclude it from Total Grants.'
                field['sourceEntryAdaptation'] = 'Source B4 is a formula using a fixed fee assumption; this draft requests a Ministry-confirmed monthly amount instead.'
            elif row == 5:
                field['help'] = 'Enter the monthly grant revenue confirmed with the Ministry. Exclude any grant amount already included in Facility Fees. This draft does not calculate grant eligibility or rates.'
                field['sourceEntryAdaptation'] = 'Source B5 is linked to the grant calculation sheet; this draft requests a Ministry-confirmed monthly amount instead.'

        section['fields'] = [f for f in section['fields'] if f['id'] != prefix + 'annual_values_by_each_budget_line']
        annual_inputs = []
        for suffix, label, row in [
            ('memberships_seca_annual', 'Memberships (SECA) — annual', 39),
            ('workshops_conferences_annual', 'Workshops and conferences — annual', 40),
            ('first_aid_cpr_cert_recert_annual', 'First aid / CPR certification and recertification — annual', 41),
            ('other_professional_development_annual', 'Other professional development — annual', 42),
        ]:
            annual_inputs.append({'id': prefix + suffix, 'label': label, 'type': 'number', 'format': 'currency',
                                  'required': False, 'aiAllowed': False, 'completenessReview': True,
                                  'sourceSheet': 'Budget ', 'sourceCell': f'C{row}', 'budgetPeriod': 'annual',
                                  'budgetRole': 'expense', 'budgetCategory': 'professional_development',
                                  'originalRequirement': {'status': 'present_on_form_not_individually_marked_required'},
                                  'help': 'Requested annual amount from the source workbook; applicability checked by reviewer. Enter zero if none. This annual amount is used instead of multiplying the corresponding monthly amount by 12.'})
        # Preserve monthly source order, then place the four annual source inputs before totals.
        first_total = next(i for i, f in enumerate(section['fields']) if f['type'] == 'calculated')
        section['fields'][first_total:first_total] = annual_inputs

        summaries = [
            ('total_expenditures', 'Total expenditures — annual', 'C64', 'annual', 'expense_total'),
            ('revenue_minus_expenditures', 'Revenue minus expenditures — annual', 'C66', 'annual', 'balance'),
            ('total_expenditures_monthly', 'Total expenditures — monthly', 'B64', 'monthly', 'expense_total'),
            ('total_revenue_annual', 'Total revenue — annual', 'C7', 'annual', 'revenue_total'),
            ('revenue_minus_expenditures_monthly', 'Revenue minus expenditures — monthly', 'B66', 'monthly', 'balance'),
        ]
        by_id = {f['id']: f for f in section['fields']}
        for suffix, label, cell, period, role in summaries:
            field = by_id.get(prefix + suffix)
            if field is None:
                field = {'id': prefix + suffix}
                section['fields'].append(field)
            field.update(label=label, type='calculated', format='currency', required=False, readonly=True,
                         aiAllowed=False, sourceSheet='Budget ', sourceCell=cell, budgetPeriod=period,
                         budgetRole=role, calculationMetadata={'sourceDeclaredCalculation': True,
                         'formulaImplemented': True, 'method': 'operating_budget_arithmetic',
                         'sourceFormulaAdapted': True})
            field['help'] = 'Preparation estimate from the amounts entered above. All expense lines are included. Annual professional-development expenses use the separate annual inputs; other monthly amounts are multiplied by 12. Ministry review is still needed.'
        section['help'] = 'Enter monthly income and expenses, plus the four annual professional-development amounts. Totals use only your entries. Confirm fee and grant income with the Ministry and count each revenue source once.'
        form['notes'].extend([
            'Operating totals are a draft preparation aid, not a funding decision. Fee and grant revenue must be entered using amounts confirmed with the Ministry; the source workbook’s grant formulas are not used.',
            'The draft includes all entered Other costs and Food in monthly totals, includes Other Revenue, and annualizes Other consumables. The source workbook omits some of these lines from its formulas. Annual professional-development costs use its four separate annual inputs.',
            'Monthly and annual professional-development entries are separate in the source workbook. Check that they express the same plan; the annual estimate does not add monthly professional-development amounts again.'
        ])

    def validate(self):
        sources = {s['id'] for s in self.sources}
        for f in self.forms:
            assert f['phase'] in {'intake', 'preopening', 'optional', 'review'}, f['id']
            assert f['kind'] in {'form', 'external', 'task', 'unavailable'}, f['id']
            assert set(f['sourceIds']) <= sources, f['id']
            fields = []
            for s in f['sections']:
                assert s['owner'] in {'Applicant', 'Ministry', 'External'}
                for x in s['fields']:
                    fields.append(x['id'])
                    if s['owner'] != 'Applicant':
                        assert not x['required'] and not x['aiAllowed'], (f['id'], x['id'])
                    if x['type'] == 'table':
                        cols = x['columns']
                        assert len({c['id'] for c in cols}) == len(cols), (f['id'], x['id'])
                        assert not any(c.get('bind') for c in cols), (f['id'], x['id'])
            assert len(fields) == len(set(fields)), f['id']
            if f['phase'] == 'optional':
                assert not f['required'], f['id']
        serialized = json.dumps(self.forms)
        assert '/Users/' not in serialized and 'work/provider-application/' not in serialized

    def compile(self):
        self.home_forms()
        self.centre_forms()
        self.external_and_tasks()
        self.funding_coverage()
        self.readable_help()
        self.forms = clean(self.forms)
        # Some official workbooks repeat labels such as Total on the same sheet.
        # Preserve every input and make only the UI identifier unique.
        for form in self.forms:
            seen = Counter()
            for section in form['sections']:
                for item in section['fields']:
                    seen[item['id']] += 1
                    if seen[item['id']] > 1:
                        item['id'] += '_' + str(seen[item['id']])
                    if item['type'] == 'table':
                        column_seen = Counter()
                        for column in item['columns']:
                            column_seen[column['id']] += 1
                            if column_seen[column['id']] > 1:
                                column['id'] += '_' + str(column_seen[column['id']])
        self.budget_mapping()
        self.validate()
        phase_counts = dict(Counter(f['phase'] for f in self.forms))
        return {
            'schemaVersion': '1.0', 'asOf': '2026-11-25', 'localOnly': True,
            'forms': self.forms, 'sources': self.sources,
            'profileDefaults': {'applicationKind': 'new', 'centrePathway': 'centre-development', 'requestingFunding': False},
            'profileConditions': {
                'applicationKind': ['new', 'expand'], 'centrePathway': ['centre-development', 'licensing-only'],
                'organizationType': ['nonprofit', 'cooperative', 'municipality', 'individual', 'partnership', 'for_profit'],
                'premisesTenure': ['owned', 'rented'], 'requestingFunding': [True, False],
                'ministryRequestedMedical': [True, False], 'ministryRequestedFinancials': [True, False],
                'alternateOutdoorPlanNeeded': [True, False]},
            'processMap': {
                'home': self.process_data('home', {'branches': self.home.get('routeBranches', []), 'steps': self.home.get('workflow', []),
                               'currentness': self.home.get('currentnessFindings', []), 'mailingAddresses': self.home.get('regionalMailingAddresses', {})}),
                'centre': self.process_data('centre', {'steps': self.centre.get('process', []), 'limitations': self.centre.get('limitations', [])}),
                'completionRules': [
                    'Local preparation is not submission, licence issuance or a funding decision.',
                    'Only explicit, applicable applicant requirements block a prepared form. Individually unmarked requested fields remain flagged for completeness review.',
                    'The proposed review acknowledgment does not replace missing evidence, official signatures, references, inspections or Ministry review.',
                    'Optional grants and operating claims are separate from initial application completion.',
                    'External and Ministry sections remain blank for the responsible party; signatures need authorized signing outside this draft.']},
            'coverage': {'inventories': self.coverage, 'formCount': len(self.forms), 'sourceCount': len(self.sources),
                         'phaseCounts': phase_counts, 'kindCounts': dict(Counter(f['kind'] for f in self.forms)),
                         'statement': 'Every inventoried form family is mapped to a digital form, external task, or explicitly unavailable template. Operating/funding forms are optional, not opening blockers.',
                         'notImplemented': ['No official submission integration', 'No electronic signature service', 'No bank or police verification', 'No automated suitability or approval scoring', 'No guessed budget or grant formulas']},
        }


if __name__ == '__main__':
    result = Compiler().compile()
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {OUTPUT.name}: {len(result["forms"])} forms, {len(result["sources"])} sources')
