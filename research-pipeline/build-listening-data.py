from pathlib import Path
import json, copy, csv
from complaint_references import assign_references

BASE=Path(__file__).resolve().parent.parent
WORK=BASE/'work'; OUT=BASE/'outputs'; DIST=WORK/'saskatchewan-dashboard'/'dist'
read=lambda name:json.loads((WORK/name).read_text())
original=read('research-v1.json')
data=copy.deepcopy(original)
data['originalResearch']=original
data['reviewedAt']='2026-11-25'
data['start']='2024-11-25'; data['end']='2026-11-25'
data['scopeNote']='The current 24-month window is 25 November 2024 to 25 November 2026. Moving the original window forward one day changes no included records. Undated LinkedIn leads are separate from the date-bounded counts.'
enrich={}
coverage=[]
for name in ['health-social-evidence.json','social-education-evidence.json','other-services-evidence.json']:
    content=read(name)
    for record in content['records']:enrich[record['existingId']]=record
    coverage.extend(content.get('coverage',[]))

for r in data['observations']:
    r['platform']='Reporting'
    r['sourceRole']='reported experience'
    if r['id'] in enrich:
        e=enrich[r['id']]
        r['originalDate']=r['date']
        for key in ['platform','authorHandle','quote','url','sourcePage','date','dateLabel','datePrecision','verification','sourceRole']:
            if key in e:r[key]=e[key]
        if r['platform']=='Reddit' and not r['authorHandle'].startswith(('u/','[')):
            r['authorHandle']='u/'+r['authorHandle']
        r['verifiedAt']='2026-11-25'
        if e.get('statusContext'):r['context']+=' '+e['statusContext']
    if r['id']=='SE01':
        r['quote']='I had called around even while pregnant but a lot of places seemed unsure of what 2026, let alone 2027 would look like with the $10/day childcare deal being up in the air.'
        r['context']='The post says the childcare deal had since been extended; this excerpt describes earlier uncertainty. It does not establish that a place was refused.'
    if r['id']=='OS12':r['quote']='view my bill using the app and each time is an error.'
    if r['id'] in ['OS12','OS13']:r['sourceTitle']='mySASKTEL app review'
    if r['id']=='SE10':
        r['summary']='Reports partner’s subsidized-childcare provider application was rejected after four months because intake had stopped.'
        r['context']='The poster says the provider continued operating privately. Licensing and program funding are not clearly distinguished; the reported intake policy was not independently verified.'
        r['sourceTitle']='Subsidized-childcare provider application discussion'

new_issue_specs={
 'student-aid-delays':{'title':'Student aid delays and unanswered enquiries','summary':'Students report unclear application progress, inconsistent enrolment status and unanswered calls.','ministry':'Advanced Education','service':'Student Service Centre / institutions / NSLSC','routeId':'student-aid'},
 'health-workforce':{'title':'Healthcare workforce reform and training concerns','summary':'LinkedIn commenters question the timing of nursing reforms and the coverage of workforce training.','ministry':'Health','service':'Health workforce and professional training','routeId':'health'},
 'sinp-policy-uncertainty':{'title':'SINP job-approval policy concerns','summary':'LinkedIn professionals criticize a historical pause in job approvals and its effects on employers and workers.','ministry':'Immigration and Career Training','service':'SINP / federal immigration allocations','routeId':'immigration'}
}
for key,spec in new_issue_specs.items():data['issues'].append({'id':key,**spec})
handles={r.get('authorHandle','').lower().removeprefix('u/'):r['authorId'] for r in data['observations'] if r['authorType']=='account'}
next_id=max(int(r['authorId'][1:]) for r in data['observations'] if r['authorType']=='account')+1
new_records=read('student-aid-evidence.json')['newRecords']
for r in read('health-social-evidence.json')['newRecords']:
    r['issueId']='health-workforce';new_records.append(r)
new_records.extend(read('immigration-social-evidence.json')['newRecords'])
for raw in new_records:
    r={k:v for k,v in raw.items() if k not in ['authorKey','attributionKey','includedInUniqueCount','issueTitle','ministry','service','routeId','quoteWordCount']}
    k=r['authorHandle'].lower().removeprefix('u/')
    if k not in handles:handles[k]=f'A{next_id:03d}';next_id+=1
    r['authorId']=handles[k];r['authorType']='account';r['counted']=bool(raw.get('counted',raw.get('includedInUniqueCount',False)))
    r['caseId']=r['id'];r['publisher']=r.get('publisher',r['platform'])
    r['sourceKind']=r.get('sourceKind','Direct public comment')
    r['sourceTitle']=r.get('sourceTitle',new_issue_specs[r['issueId']]['title'])
    r['region']=r.get('region','Saskatchewan policy discussion')
    r['status']=r.get('status','Policy concern; no individual service outcome established.')
    r['context']=r.get('context',r.get('exclusionReason',''))
    r['verifiedAt']='2026-11-25'
    data['observations'].append(r)

student=read('student-aid-evidence.json')
route=student['route']
data['routes'].append({'id':route['id'],'title':route['title'],'ministry':route['ministry'],'first':route['firstStep'],'escalation':route['responsibility'],'note':route['notes'],'links':route['sources']})
data['routes'].append(read('immigration-social-evidence.json')['route'])
ai=read('ai-opportunities.json')
opportunities=ai['opportunities']+ai['supplementaryTopics']
ai_by_id={x['id']:x for x in opportunities}
for issue in data['issues']:
    if issue['id']=='childcare-licensing':
        issue['title']='Subsidized-childcare provider application delays'
        issue['summary']='A provider’s partner reports an application rejected after months of waiting because program intake had stopped.'
    assessment=ai_by_id[issue['id']]
    for field in ['concern','why','fit','idea','limit','firstStep','measure','priority','reason']:issue[field]=assessment[field]
data['priorityMeaning']=ai['priorityMeaning']
data['topSuggestions']=ai['topThreeSuggestions']
data['coverage']=[
 'This is a targeted public-source review, not an exhaustive search or representative survey. Counts describe the collected evidence.',
 'All 70 observations from the original dashboard remain available. Six student-aid accounts and four date-unverified LinkedIn comments were added.',
 'Social accounts are not verified people. Named complainants in reporting are a separate count; they may overlap with accounts.',
 'A quoted post is evidence that someone expressed a concern, not proof of a service failure. Resolutions and conflicting context are retained.',
 'Reddit and App Store evidence dominate the dated sample. Public-web searches cannot comprehensively cover X, LinkedIn, Quora, private groups or deleted content.',
 'LinkedIn professional and advocacy comments are visible but lack verified calendar dates. They are tracked as leads and excluded from date-bounded account counts.',
 'Some Reddit dates identify the parent discussion, not the exact comment. Do not infer daily trends from these dates.',
 'AI opportunities are proposed discovery tasks. Some problems need clearer processes, reliable data or ordinary software fixes before AI is useful.',
 'Benefits, clinical priority, claims, safeguarding and emergency decisions remain with authorized staff; the proposed AI work is assistance, not decision replacement.',
 'Service responsibility can be shared: student aid spans the province, institutions and NSLSC; immigration allocations also involve the federal government.',
 'A missing topic or platform means a gap in this review, not that nobody has complained about it.'
]
coverage.extend([{'platform':'Reddit','scope':'Student aid','notes':student['coverage']}])
coverage.extend(read('immigration-social-evidence.json')['coverage'])
data['searchCoverage']=coverage
for row in data['official']:
    row.update({'year':2025,'unit':'requests for assistance','sourceUrl':'https://ombudsman.sk.ca/app/uploads/2026/04/2025-OMB-Annual-Report-Final.pdf'})
data['platformCoverage']=[
 {'platform':'Reddit','note':'48 distinct accounts counted; one deleted author retained without a count. Quotes and public handles checked.'},
 {'platform':'App Store','note':'2 reviewer accounts counted. Direct reviews of the mySASKTEL app.'},
 {'platform':'LinkedIn','note':'4 visible professional / advocacy comments retained as leads. Calendar dates unverified; excluded from counts.'},
 {'platform':'X / Twitter','note':'Targeted searches found no directly verifiable, attributable and dated posts for this sample. This does not mean no complaints exist.'},
 {'platform':'Quora','note':'Original pages could not be reviewed because access was blocked. No Quora accounts counted.'},
 {'platform':'News & reports','note':'25 named complainants retained separately as supporting reporting, not direct social posts.'}
]
ids={i['id'] for i in data['issues']}
assign_references(data)
assert len(data['observations'])==80
assert all(r['issueId'] in ids for r in data['observations'])
assert all(r.get('quote') for r in data['observations'] if r['platform']!='Reporting')
assert {r['id'] for r in original['observations']} <= {r['id'] for r in data['observations']}
assert len({r['authorId'] for r in data['observations'] if r['counted'] and r['authorType']=='account'})==50
assert len({r['authorId'] for r in data['observations'] if r['counted'] and r['authorType']=='person'})==25
text=json.dumps(data,ensure_ascii=False,indent=2)
(DIST/'listening-data.js').write_text('window.LISTENING = '+text.replace('<','\\u003c')+';\n')
(OUT/'saskatchewan-complaints-data.json').write_text(text+'\n')
(DIST/'index.html').write_text((WORK/'dashboard-v2.html').read_text())

def safe(v):
    s=str(v if v is not None else '')
    return "'"+s if s.startswith(('=','+','-','@','\t','\r')) else s
with (OUT/'complaint-evidence.csv').open('w',encoding='utf-8-sig',newline='') as f:
    fields=['referenceId','complaintReferenceId','id','issueId','platform','authorId','authorHandle','authorType','sourceRole','counted','date','dateLabel','datePrecision','quote','summary','url','sourcePage','sourceTitle','publisher','status','context','verification']
    w=csv.writer(f);w.writerow(fields)
    for r in data['observations']:w.writerow([safe(r.get(k,'')) for k in fields])
with (OUT/'complaint-issues.csv').open('w',encoding='utf-8-sig',newline='') as f:
    fields=['referenceId','id','concern','why','public_accounts','named_in_reporting','uncounted_social_records','ministry','service','fit','idea','limit','firstStep','measure','reason','source_urls']
    w=csv.writer(f);w.writerow(fields)
    for i in sorted(data['issues'],key=lambda x:x['priority']):
        rows=[r for r in data['observations'] if r['issueId']==i['id']]
        vals={**i,'public_accounts':len({r['authorId'] for r in rows if r['counted'] and r['authorType']=='account'}),'named_in_reporting':len({r['authorId'] for r in rows if r['counted'] and r['authorType']=='person'}),'uncounted_social_records':sum(not r['counted'] and r['platform']!='Reporting' for r in rows),'source_urls':' | '.join(sorted({r['url'] for r in rows}))}
        w.writerow([safe(vals.get(k,'')) for k in fields])
print(json.dumps({'records':len(data['observations']),'issues':len(data['issues']),'socialAccounts':50,'namedInReporting':25,'directExcerpts':sum('quote' in r for r in data['observations'])}))
