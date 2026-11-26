import json
from pathlib import Path
raw=json.loads(Path('research/providers.json').read_text())
byurl={s['url']:s for s in raw['sources']}
providers=[]
for p in raw['providers']:
    age=p.get('age') or {}; hours=p.get('hours') or {}; a=p['address']
    minm=age.get('minMonths'); maxm=age.get('maxMonths'); minw=age.get('minWeeks')
    if minm is not None and maxm is not None:
        label=f'{minm} months–{int(maxm/12)} years'
    elif minw and maxm:
        label=f'{minw} weeks–{int(maxm/12)} years'
    elif minm is not None: label=f'{minm} months+; confirm upper age'
    elif minw: label=f'{minw} weeks–kindergarten'
    elif age.get('groups'): label='Toddler and preschool; confirm ages'
    else: label='Ages unconfirmed'
    notes=[c['resolution']+' '+ ('Government: '+c['governmentValue']+'. ' if c.get('governmentValue') else '')+('Other listing: '+c['otherValue'] if c.get('otherValue') else '') for c in p.get('conflicts',[])]
    notes+=p.get('notes',[])
    if age.get('description'): notes.append(age['description'])
    if hours.get('infantOverride'): notes.append('Infant hours are 7:30 am–5:30 pm. Other age groups use the general hours shown.')
    if hours and not hours.get('days'): notes.append('Operating days have not been verified. Confirm your requested days directly.')
    app=p['application']; closed=app['status']=='provider_reports_waitlist_closed'
    providers.append({'id':p['id'],'name':p['name'],'aliases':[p['governmentName']], 'type':'home' if 'home' in p['type'] else 'centre','neighbourhood':p['neighbourhood'],'address':f"{a['street']}, {a['city']}, {a['province']} {a['postalCode']}", 'lat':p['coordinates']['lat'],'lon':p['coordinates']['lng'], 'locationNote':'Approximate government map location. Confirm the address before travelling.' + (' Address sources conflict; see notes below.' if any(c['field']=='address' for c in p.get('conflicts',[])) else ''),'phone':p.get('phone'),'website':next((s for s in p['sourceUrls'] if 'saskatchewan.ca' not in s and '211.ca' not in s),None),'minAgeMonths':minm,'minAgeDays':minw*7 if minw else None,'maxAgeMonths':maxm,'ageDescription':label,'open':hours.get('opens'),'close':hours.get('closes'),'days':[s.title() for s in hours['days']] if hours.get('days') else None,'infantHours':{'open':hours['infantOverride']['opens'],'close':hours['infantOverride']['closes']} if hours.get('infantOverride') else None,'languages':None,'feeMonthly':None,'feeNote':'Current fees and eligibility have not been reconfirmed. Ask the provider about base fees and extras.','availability':'closed' if closed else 'unknown','availabilityUpdated':None,'availabilityNote':'Provider website reports waitlist registration closed; reviewed November 25, 2026.' if closed else None,'connected':False,'demo':False,'applicationUrl':app.get('url') if not closed else None,'applicationNote':('The provider reports its waiting list is closed. Contact them to ask about future intake.' if closed else 'Apply through the provider’s own website. This local dashboard does not send your family profile.' if app.get('url') else 'Contact the provider directly. A current online application route has not been verified.'),'licensingNote':'Listed in Saskatchewan’s regulated child care directory. A live licence feed is not connected.','sourceNotes':notes,'sources':[{'label':byurl[u]['title'],'url':u} for u in p['sourceUrls'] if u in byurl],'reviewedAt':'November 25, 2026'})
for id,name,area,lat,lon,typ,op,cl,fee in [('demo-sprouts','Prairie Sprouts · Example provider','Willowgrove',52.151,-106.553,'centre','08:00','17:30',250),('demo-willow','Little Willow · Example provider','Evergreen',52.171,-106.576,'home','07:00','18:00',300)]:
    providers.append({'id':id,'name':name,'aliases':[],'type':typ,'neighbourhood':area,'address':f'Illustrative location in {area}, Saskatoon','lat':lat,'lon':lon,'locationNote':'Fictional example location, not a real facility.','phone':None,'website':None,'minAgeMonths':18 if typ=='centre' else 3,'maxAgeMonths':72,'ageDescription':'18 months–6 years' if typ=='centre' else '3 months–6 years','open':op,'close':cl,'days':['Mon','Tue','Wed','Thu','Fri'],'languages':['English','French'] if typ=='home' else ['English'],'feeMonthly':fee,'feeNote':'Illustrative fee for the example provider, not a real market rate or subsidy determination.','availability':'accepting','availabilityUpdated':'2026-11-25T18:00:00Z','connected':True,'demo':True,'applicationUrl':None,'sourceNotes':[],'sources':[],'reviewedAt':'November 25, 2026'})
Path('server/providers.json').write_text(json.dumps(providers,ensure_ascii=False,indent=2)+'\n')
print(f'Prepared {len(providers)} records: {sum(not p["demo"] for p in providers)} public listings and 2 fictional connected examples.')
