import json
from pathlib import Path

ROOT = Path(__file__).parent
reviewed = '2026-11-25'
sources = {
  'gov': ('Government of Saskatchewan regulated child care directory', 'https://www.saskatchewan.ca/residents/family-and-social-support/child-care/find-a-child-care-provider-in-my-community', 'government'),
  'ymca': ('YMCA Saskatoon early learning and childcare', 'https://ymcasaskatoon.org/early-learning-and-childcare/', 'provider'),
  'ymcaAspenPC': ('Parent Central — YMCA Aspen Ridge', 'https://parentcentral.sk.211.ca/services/saskatoon-aspen-ridge/child-care-aspen-ridge-2/', 'directory'),
  'ymcaBrightonPC': ('Parent Central — YMCA Brighton', 'https://parentcentral.sk.211.ca/services/child-development-centre-brighton/child-care-child-development-centre-brighton/', 'directory'),
  'newLeafAspenPC': ('Parent Central — New Leaf Aspen Ridge', 'https://parentcentral.sk.211.ca/services/new-leaf-daycare-aspen-ridge/child-care-aspen-ridge/', 'directory'),
  'newLeafEvergreenPC': ('Parent Central — New Leaf Evergreen', 'https://parentcentral.sk.211.ca/services/new-leaf-daycare-evergreen/child-care-evergreen/', 'directory'),
  'preston': ('Preston — Willowgrove location', 'https://www.prestonearlylearning.ca/willowgrove', 'provider'),
  'prestonApply': ('Preston — admissions and waiting list', 'https://www.prestonearlylearning.ca/admissions', 'provider'),
  'prestonHours': ('Preston — parent manual April 2025', 'https://www.prestonearlylearning.ca/s/Parent-Manual-April-2025.pdf', 'provider'),
  'bright': ('Bright Learners — Willowgrove location', 'https://brightlearnersacademy.net/location-Willowgrove/', 'provider'),
  'brightApply': ('Bright Learners — Willowgrove registration form', 'https://brightlearnersacademy.net/registration-willowgrove/', 'provider'),
  'bgc': ('BGC Saskatoon — early learning centres', 'https://www.bgcsaskatoon.com/programs/early-learning-centres/', 'provider'),
  'bgcPC': ('Parent Central — Evergreen ELC', 'https://parentcentral.sk.211.ca/services/evergreen-early-learning-centre/child-care-evergreen-early-learning-centre/', 'directory'),
}

def url(key): return sources[key][1]
def hours(start, end, source, days=None):
    return {'opens':start,'closes':end,'days':days,'source':source,'status':'published_hours_not_provider_reconfirmed'}
weekdays=['mon','tue','wed','thu','fri']
rows=json.loads((ROOT/'government-matches.json').read_text())
configs=[
  dict(id='new-leaf-evergreen', name='New Leaf Daycare — Evergreen', street='90 - 110 Evergreen Square',postal='S7W 0W8',neighbourhood='Evergreen',type='centre', phone='306-621-0053', source='newLeafEvergreenPC',age={'minMonths':4,'maxMonths':72,'groups':['infant','toddler','preschool'],'source':'newLeafEvergreenPC'},hours=hours('07:30','17:30','newLeafEvergreenPC',weekdays),care=['full-time','part-time'],application={'mode':'contact','url':None,'informationUrl':url('newLeafEvergreenPC'),'status':'current_application_route_unverified'},conflicts=[{'field':'address','governmentValue':'90 - 110 Evergreen Square, S7W 0W8','otherValue':'100 - 245 Evergreen Square, S7W 1G4','sources':['gov','newLeafEvergreenPC'],'resolution':'Unresolved. Pin follows government listing; confirm location before travel.'}],notes=['Government listing is named New Leaf Daycare. Evergreen association follows the street/neighbourhood and matching provider phone.','Parent Central registration link https://newleafdaycare.com/registration/ returned 404 during review.']),
  dict(id='preston-willowgrove',name='Preston Early Learning Centre — Holy Family/Willowgrove',street='805 Stensrud Road',postal='S7W 0M9',neighbourhood='Willowgrove',type='centre',phone='306-373-3535',source='preston',age={'minWeeks':6,'maxMonths':None,'groups':['infant','toddler','preschool','kindergarten'],'description':'Six weeks through kindergarten; location page describes six weeks to five years.','source':'preston'},hours={**hours('07:15','18:00','prestonHours',weekdays),'infantOverride':{'opens':'07:30','closes':'17:30'}},care=['full-time'],application={'mode':'external','url':url('prestonApply'),'status':'provider_waitlist_application_link_published'},notes=['Provider reports full centres and a long shared waitlist; no verified live vacancy count.','One application per child; provider prioritizes internal age-group moves and siblings. Age-specific infant hours matter when matching schedules.']),
  dict(id='bright-learners-willowgrove',name='Bright Learners Academy — Willowgrove',street='415 Willowgrove Square',postal='S7W 0G8',neighbourhood='Willowgrove',type='centre',phone='306-244-2404',source='bright',age={'minMonths':None,'maxMonths':None,'groups':['toddler','preschool'],'description':'Location-specific page lists toddler and preschool programs; exact age bounds unconfirmed.','source':'bright'},hours=hours('07:00','17:30','bright'),care=['full-time'],application={'mode':'external','url':url('brightApply'),'status':'provider_web_form_observed','alternatePublishedUrl':'https://himama.com/online_registration/apply/bright-leaners-academy-willowgrove','alternateStatus':'linked_by_provider_location_page_but_destination_not_verified'},notes=['Operating days are not explicitly stated on the location page.','Organization-wide infant and school-age programs must not be assumed to operate at Willowgrove.']),
  dict(id='ymca-brighton',name='YMCA Child Development Centre — Brighton',street='115 Secord Way',postal='S7V 0L9',neighbourhood='Brighton',type='centre',phone='306-374-3502',source='ymcaBrightonPC',age={'minWeeks':6,'maxMonths':72,'groups':['infant','toddler','preschool'],'source':'ymcaBrightonPC','minimumAgePrimarySource':'ymca'},hours=hours('07:30','18:00','ymcaBrightonPC',weekdays),care=['full-time'],application={'mode':'external','url':'https://app.lillio.com/online_registration/apply/ymca-brighton','status':'provider_application_link_published_intake_status_conflicts','source':'ymca'},conflicts=[{'field':'application.status','providerValue':'YMCA primary page links a Brighton Join Waitlist application.','otherValue':'Parent Central says waitlist closed and no new applications.','sources':['ymca','ymcaBrightonPC'],'resolution':'Show provider link and disclose conflict. Do not infer an open seat or guaranteed intake.'}],notes=['Closed weekends and statutory holidays according to Parent Central.']),
  dict(id='bgc-evergreen',name='BGC Saskatoon — Evergreen Early Learning Centre',street='616 Manek Road',postal='S7W 0W3',neighbourhood='Evergreen',type='centre',phone='306-373-3111',email='evergreenelc@bgcsaskatoon.com',source='bgc',age={'minWeeks':6,'maxMonths':None,'groups':['infant','toddler','preschool','kindergarten'],'description':'Infants, toddlers and preschool children including kindergarten.','source':'bgc'},hours=hours('07:00','18:00','bgc',weekdays),care=['full-time'],application={'mode':'closed','url':None,'informationUrl':url('bgc'),'status':'provider_reports_waitlist_closed','contactPreference':'Email only for availability and waitlist questions; provider asks families not to call.'},notes=['Primary provider page reports waiting list registration currently closed; this is a page statement, not a live integration.','Weekdays are corroborated by Parent Central.']),
  dict(id='christine-wilmut',name='Christine Wilmut',street='218 Lamarsh Road',postal='S7W 1B8',neighbourhood='Willowgrove',type='family-home',phone='306-651-1875',source='gov',age={'minMonths':None,'maxMonths':None,'groups':None,'source':None},hours=None,care=None,application={'mode':'contact','url':None,'status':'contact_provider_for_process'},notes=['Public regulated home listing. Age range, operating hours, fees and current intake were not verified.']),
  dict(id='shazia-kousar',name='Shazia Kousar',street='606 Boykowich Crescent',postal='S7W 0S5',neighbourhood='Evergreen',type='group-family-home',phone='639-317-7505',source='gov',age={'minMonths':None,'maxMonths':None,'groups':None,'source':None},hours=None,care=None,application={'mode':'contact','url':None,'status':'contact_provider_for_process'},notes=['Public regulated group family home listing. Age range, operating hours, fees and current intake were not verified.']),
  dict(id='new-leaf-aspen-ridge',name='New Leaf Daycare — Aspen Ridge',street='70 - 1164 Baltzan Boulevard',postal='S7W 1E8',neighbourhood='Aspen Ridge',type='centre',phone='306-621-0053',source='newLeafAspenPC',age={'minMonths':4,'maxMonths':72,'groups':['infant','toddler','preschool'],'source':'newLeafAspenPC'},hours=hours('07:30','17:30','newLeafAspenPC',weekdays),care=['full-time','part-time'],application={'mode':'contact','url':None,'informationUrl':url('newLeafAspenPC'),'status':'current_application_route_unverified'},notes=['Parent Central spells the street Baltzen; this record uses government directory spelling Baltzan.','Parent Central registration link https://newleafdaycare.com/registration/ returned 404 during review.']),
  dict(id='ymca-aspen-ridge',name='YMCA Child Development Centre — Aspen Ridge',street='260 Orban Way',postal='S7W 1E7',neighbourhood='Aspen Ridge',type='centre',phone='306-500-1312',source='ymcaAspenPC',age={'minMonths':18,'maxMonths':None,'groups':['toddler','preschool'],'description':'18 months and older on YMCA site; Parent Central describes 18 months to five years.','source':'ymca','upperAgeSource':'ymcaAspenPC'},hours=hours('07:30','18:00','ymcaAspenPC',weekdays),care=['full-time'],application={'mode':'external','url':'https://app.lillio.com/online_registration/apply/ymca-aspen-ridge','status':'provider_application_link_published','source':'ymca'},conflicts=[{'field':'postalCode','governmentValue':'S7W 1E7','providerValue':'S7W 1M1','sources':['gov','ymca'],'resolution':'Same street address; government postal code retained.'}],notes=[])
]

providers=[]
for row,c in zip(rows,configs):
    primary=c.pop('source')
    p={
      'id':c.pop('id'), 'name':c.pop('name'), 'governmentName':row['name'],
      'type':c.pop('type'),
      'address':{'street':c.pop('street'),'city':'Saskatoon','province':'SK','postalCode':c.pop('postal')},
      'neighbourhood':c.pop('neighbourhood'),
      'coordinates':{**row['coordinates'],'accuracy':'government_map_approximate','source':'gov','sourceUrl':url('gov'),'method':'Government map pageList point matched to same-download directory row by index; government JavaScript confirms this positional mapping.','sourceRowOrdinal':row['ordinal']},
      'directionsUrl':row['directions_url'],
      'licensing':{'status':'listed_in_government_regulated_directory','licenceNumber':None,'source':'gov','note':'Directory listing verified; current licence certificate and number not independently obtained.'},
      'availability':{'status':'unconfirmed','spaces':None,'confirmedAt':None,'note':'No live provider connection. Published application links do not indicate a vacancy.'},
      'fees':{'monthlyCAD':None,'status':'not_provider_reconfirmed','note':'Confirm current fee eligibility and extras with provider.'},
      'connectedToDashboard':False,
      'reviewedAt':reviewed,
      'fieldSources':{'name':['gov',primary],'type':['gov'],'address':['gov'],'phone':['gov'],'coordinates':['gov'],'age':[c['age']['source']] if c['age']['source'] else [],'hours':[c['hours']['source']] if c['hours'] else [],'care':[primary] if c['care'] else [],'application':[c['application'].get('source',primary)],'neighbourhood':[]},
      **c,
    }
    p['fieldSources']['neighbourhoodNote']='Geographic label used for browsing, not provider-verified catchment.'
    p.setdefault('conflicts',[])
    if p['id']=='bgc-evergreen':
        p['fieldSources']['hours'].append('bgcPC')
        p['fees']={'monthlyCAD':217.50,'status':'published_provider_fee','effectiveDate':'2026-04-01','source':'bgc','note':'Published parent portion for eligible younger age groups. Six-year-old eligibility varies by school year/summer; payment and late fees are additional. Confirm eligibility.'}
    if p['id']=='preston-willowgrove':
        p['fees']={'monthlyCAD':217.50,'status':'published_provider_fee','effectiveDate':None,'source':'prestonApply','note':'Published infant/toddler and eligible preschool/kindergarten monthly fee. Older-child and summer rates differ.'}
    p['fieldSources']['fees']=[p['fees']['source']] if p['fees'].get('source') else []
    p['sourceUrls']=list(dict.fromkeys([url('gov'),url(primary)]+[url(k) for k in p['fieldSources'].get('hours',[])]+[url(k) for k in p['fieldSources'].get('application',[])]))
    providers.append(p)

result={
 'schemaVersion':1,'reviewedAt':reviewed,'scope':'Bounded northeast/east Saskatoon sample; not a complete registry. Nine government-listed locations.','providers':providers,
 'sources':[{'id':k,'title':v[0],'url':v[1],'kind':v[2],'reviewedAt':reviewed} for k,v in sources.items()],
 'notes':[
   'All coordinates were extracted from the public Saskatchewan directory map, not estimated or geocoded. The directory expressly says its map locations are approximate only. Do not present street-level precision or route travel times.',
   'List and coordinate arrays contained 1,414 entries each in the same downloaded HTML. Government script assigns each map marker its array index and each list item selects the marker using its list index.',
   'Nine records provide a working seed catalogue only. No comprehensive coverage or missing-provider resolution is claimed. BLOSSOMS and Brighton Family Childcare are not included because sufficient identity/location/licensing evidence was not verified in this bounded pass.',
   'No live vacancies, queue positions, confirmed response times or licence numbers were invented. Zero counts in Parent Central were not interpreted as current availability.',
   'Published directory information may be stale. Provider-operated application links take precedence for routing while source conflicts remain visible.',
   'No application was submitted and no family data was sent to any provider. Local dashboard demonstration submissions must be clearly distinguished from real provider submissions.',
   'Unknown hours, age eligibility and accessibility must remain unknown rather than being treated as a negative filter match. Confirmed-fit and incomplete-information results should be distinguishable.'
 ]
}
(ROOT/'providers.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(f'Wrote {len(providers)} providers with {len(sources)} sources')
