import json
from pathlib import Path
p=Path(__file__).parent/'home-forms.json';d=json.loads(p.read_text())
explicit={
'home_licence_application':{'licence_type','references','signature','signature_date','law_acknowledgment'},
'family_assessment':set(),
'direct_deposit':{'request_type','authorizing_signature'},
'information_release':{'optional_release','signature'},
'fire_health_safety_grant':{'total','signature','date','intended_use','estimates_attached','retain_receipts','repayment'},
'startup_grant':{'category','total','signature','date','intended_use','retain_receipts','repayment'},
'nutrition_grant':{'signature','date','intended_use','menu_attached'},
'active_play_grant':{'facility_category','signature','date','intended_use','retain_receipts','repayment'},
'play_exploration_grant':{'facility_category','signature','date','intended_use','phase1_certificate','retain_receipts','repayment'},
'change_information':{'change_types','law_acknowledgment','signature','date'},
'expansion_assessment':{'expansion_type','current_capacity','additional_spaces','requested_capacity','rationale','floor_plan','measurements','washrooms','signature','date'},
'self_assessment':{'signature','date'},
}
no_ai_forms={'family_assessment','reference_questionnaire','direct_deposit','information_release','self_assessment','change_information','expansion_assessment'}
def annotate(f,section,fields,prefix=''):
 for x in fields:
  x['bindingKey']='.'.join([f['id'],section['id']]+([prefix] if prefix else [])+[x['id']])
  own=x.get('owner','applicant')
  if own!='applicant':
   req={'status':'other_party_only','applicantCompletionBlocking':False,'reason':'Completed by '+own+'; never require applicant to answer or sign this section.'}
  elif x.get('officialSeparateEntryField') is False:
   req={'status':'derived_display_only','applicantCompletionBlocking':False,'reason':'Calculated display, not a separate required entry on the printed form.'}
  elif x.get('annualOnly'):
   req={'status':'conditional','condition':'Annual review only; not initial licensing.','applicantCompletionBlocking':False}
  elif x.get('requiredIf'):
   req={'status':'conditional','condition':x['requiredIf'],'applicantCompletionBlocking':False,'reason':'Evaluate applicability before showing any completion warning.'}
  elif x['id'] in {'previous_names','decline','decline_amount','already_operating','mailing_same','additional','estimates'}:
   req={'status':'conditional_or_optional','applicantCompletionBlocking':False,'reason':'Complete or select only when applicable; a negative or not-applicable response is legitimate.'}
  elif x['id'] in explicit.get(f['id'],set()):
   req={'status':'explicit_required_for_this_form_when_applicable','applicantCompletionBlocking':f['stage']=='initial_application','basis':'Source instructions require the relevant choice, supporting information, or signature; form itself may be conditional.'}
  else:
   req={'status':'present_on_form_not_individually_marked_required','applicantCompletionBlocking':False,'basis':'Verified printed field/prompt; source does not separately mark it mandatory. Complete relevant information; flag omissions for review rather than invent hard validation.'}
  if f['classification'] in ['optional_grant_application','conditional_grant_attachment']:
   req['formCondition']='Only when applicant elects this grant and eligibility/timing applies.'
   req['applicantCompletionBlocking']=False
  if f['id']=='family_assessment':
   req['reason']='The questionnaire is a required initial attachment, but some personal prompts may be inapplicable. Do not invent answers or force irrelevant disclosures; use a clear not-applicable response where appropriate.'
  x['requirement']=req
  sensitive=(f['id'] in no_ai_forms or x['type'] in ['signature','external_document'] or any(t in x['id'] for t in ['birth','household','reference','entitlement','signature','crc','account','bank','telephone','email','phone','address']))
  x['aiAssistance']={'enabledByDefault':False if sensitive else True,'allowedUse':'None by default; never infer personal facts, suitability, consent, signatures or official decisions.' if sensitive else 'Optional drafting help for general provider-authored wording; user must verify factual commitments. No automatic approval or scoring.','reason':'Sensitive, third-party, consent or attestation information.' if sensitive else 'Non-sensitive operational drafting, subject to user review.'}
  if x.get('fields'):annotate(f,section,x['fields'],prefix=(prefix+'.' if prefix else '')+x['id'])
for f in d['forms']:
 f['fieldRequirednessPolicy']='Explicit form instructions, conditional applicability and individually unmarked fields are distinguished. No field becomes mandatory merely because a blank line exists.'
 f['applicantPacketCompletion']='Applicant portions and applicable attachments only. Exclude consultant, ministry, reference, bank and inspector completion from initial applicant readiness.'
 f['aiSafety']={'eligibilityOrSuitabilityScoring':False,'sensitivePersonalNarrativeAssistance':False,'backgroundCheckProcessingByAI':False,'officialDecisionGeneration':False}
 for s in f['sections']:annotate(f,s,s['fields'])
 if f['id']=='active_play_grant':
  f['eligibility']='Home must already be licensed to receive Active Play funding; one-time grant. Prepare separately during opening if useful; do not label eligible for payment before licence.'
  f['sourceIds'].append('active-info')
 if f['id']=='play_exploration_grant':
  f['eligibility']='Grant is for regulated facilities; home provider must have completed Play and Exploration Phase I and attach certificate. No approval or automatic award implied.'
  f['sourceIds'].append('play-info')
 if f['id']=='startup_grant':
  f['paymentTiming']='Paid after all licensing requirements met and a licence issued; application goes to assigned ELCC Consultant.'
 if f['id']=='fire_health_safety_grant':
  f['paymentTiming']='Typically paid after fire inspection and before licensed operations; application goes to assigned ELCC Consultant.'
# Readable currentness notes for immediate UI implementation.
d['currentnessFindings']=[
 {'id':'group_initial12_then16','severity':'critical','finding':'The September 2026 application correctly presents up to 12 for a NEW group home under current Ministry intake policy. Existing group homes may apply for up to 16 only after holding a REGULAR licence for at least two years and meeting need, space and other approval requirements. The statutory ceiling of 16 is not an initial licence entitlement.','sourceIds':['home-application','faq','group-update','expansion','regulations']},
 {'id':'current_application_changes','finding':'Use the September 2026 application. It asks entitlement to work AND study, adds the Act/regulations acknowledgment, and uses an existing-care checkbox. The former Saskatoon Open Door Society question has been removed.','sourceIds':['home-application']},
 {'id':'direct_deposit_current','finding':'Use M221 Rev.12/23, with supplier fields and Ministry phone-verification section. An electronic signature needs digital certification or an identifying audit trail. Do not use older indexed forms.','sourceIds':['deposit']},
 {'id':'play_public','finding':'Current catalogues publish December 2025 Active Play and Play & Exploration forms and planning templates. The webpage statement that forms are only supplied after application is not an availability restriction. Grant eligibility and timing still apply.','sourceIds':['opening-catalogue','grants-page','active-play','play-exploration']},
 {'id':'selfassessment_ece','finding':'The current published self-assessment still prints a 40-hour ECE course. Current regulation 61 requires a 45-hour introductory course or approved equivalent within one year; group ECE I within three years. Do not validate using the stale printed 40-hour number.','sourceIds':['self-assessment','regulations']},
 {'id':'faq_startup_amount','finding':'The current FAQ lists $3,325 for start-up, but the current grant form and grant webpage list $3,525 for a family home. Use the actual grant form for the requested amount and flag the discrepancy for confirmation.','sourceIds':['faq','startup-grant','grants-page']},
 {'id':'old_checklist','finding':'The historical checklist is visible in the search index, but its live URL returns 404 and it is absent from the current opening-home catalogue. Use the current application page/FAQ for process: two initial sessions, two final sessions, Learning Plans, visits and local-need screening. No guaranteed four-week issuance.','sourceIds':['historical-checklist','apply-page','faq']},
 {'id':'assistant_not_only_total9','finding':'An assistant must be present whenever numbers AND ages exceed the family-home chart, including some combinations of eight or fewer. Working alone requires compliance with family-home limits.','sourceIds':['group-update','regulations']},
 {'id':'different_consents','finding':'Consent to optional third-party contact releases, parental referral opt-out, and disclosure of relevant criminal-check information are three distinct matters. Do not merge them into one consent checkbox.','sourceIds':['information-release','regulations']},
 {'id':'funding_timing','finding':'Fire/Health/Safety is usually paid after fire inspection before opening; Start-Up is paid after licence issuance. Active Play requires a licensed home; Play & Exploration requires the home provider’s Phase I workshop certificate. Optional grant forms never block the initial licence packet.','sourceIds':['grants-guidance','active-info','play-info']}]
# Readable route summaries; original source-driven detail remains under workflow.
d['routeBranches']=[
 {'id':'new_family_home','label':'New family child care home','condition':'Not already licensed for this home; residential child care with up to eight attending children, subject to age and resident-child rules.','initialForms':['home_licence_application','family_assessment','direct_deposit'],'initialMaximum':8,'sourceIds':['home-application','faq']},
 {'id':'new_group_home','label':'New group family child care home','condition':'Not already licensed for this home; initial group licence may have up to 12 spaces. Assistant required whenever family-home number/age limits are exceeded.','initialForms':['home_licence_application','family_assessment','direct_deposit'],'initialMaximum':12,'futureMaximum':16,'futureCondition':'Existing group home: at least two years with a regular licence; expansion approval and all other requirements.','sourceIds':['home-application','faq','group-update']},
 {'id':'existing_family_to_group','label':'Convert an existing licensed family home to a group home','condition':'Existing licensed family home seeking conversion.','initialForms':['change_information','expansion_assessment'],'sourceIds':['change-information','expansion']},
 {'id':'existing_group_expand','label':'Expand an existing group home beyond 12 spaces','condition':'Existing licensed group home with at least two years on a regular licence; demonstrated need in a Ministry-identified area and adequate space/staffing.','initialForms':['change_information','expansion_assessment'],'maximum':16,'sourceIds':['group-update','expansion']},
 {'id':'existing_other_change','label':'Update an existing home licence','condition':'Change name, address, residents, licence type or spaces. Add expansion questionnaire only for conversion to group or expansion beyond 12.','initialForms':['change_information'],'sourceIds':['change-information']}]
d['aiExclusionsByDefault']=['All family-assessment narrative and health/relationship answers','Applicant or resident identity, birth dates and immigration/work-study details','Criminal record/vulnerable-sector checks and disclosure consents','Reference statements and contact details','Banking information, void cheques and financial institution certification','Signatures, consent decisions and official attestations','Consultant fitness findings, inspector judgments, Ministry eligibility/approval decisions','Any ranking or scoring of applicant suitability']
d['mandatoryVsOptionalPolicy']={'explicit':'Use requirements directly stated in a current form, regulation or process instruction.','conditional':'Evaluate selected route, grant choice, existing/new status and factual applicability first.','unmarked':'A printed blank line alone does not establish mandatory validation. Highlight missing relevant information for review without invented hard stops.','thirdParty':'Never block applicant readiness because a consultant, reference, bank or inspector has not completed a section that belongs to them. Separately track external evidence needed for final licensing.','optionalGrant':'Declining or not selecting a grant does not make the licensing application incomplete.'}
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('Updated requiredness and AI flags:',len(d['forms']),'forms;',len(d['routeBranches']),'branches')
