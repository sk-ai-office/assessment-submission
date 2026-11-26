import json
from pathlib import Path
source=json.loads(Path('work/social-education-research.json').read_text())
quotes={
'SE01':"I also don’t think the details are super clear yet.",
'SE02':"She’s 11 months old and I’m still 100+ on those waitlists.",
'SE03':"Subsidized will take a lot of calling and annoying people and luck.",
'SE04':"We got in a licensed day care after about 11 months.",
'SE05':"My son is nearly two and we were on dozens of wait lists about 6 months before he was born, I have had one call back lol.",
'SE06':"everywhere all the lists seem to be packed with minimal movement, or some of the facilities don’t even accept waitlist applications anymore.",
'SE07':"Two years later, I've heard from one of them about a spot.",
'SE08':"The best I could do was get each child in a different daycare.",
'SE09':"I have two kids in daycare, we were unable to get into subsidized.",
'SE10':"My partner was just notified after waiting for 4 months to have her application processed that the program has cut off new applications and are happy with the number of daycares they have.",
'SE11':"we can't get though to our workers as they are swamped with people who don't have workers.",
'SE12':"I never gotten a real answer why",
'SE13':"I called over 60 times one day because I kept on getting all of the people are busy and got hung up on.",
'SE14':"They've asked for all my paperwork again, even though I gave my renewal stuff at the start of the year, and resubmitted forms they lost by April.",
'SE15':"it always just feels hostile like they’re looking for a reason to cut you off.",
'SE16':"without living with my family I feel like I couldn’t even be independent without them.",
'SE17':"It has happened to me just getting reimbursed from the Federal Gov't. Super bad news. Straight up stuck in a trap.",
'SE18':"They live together to get by because there is no other way for them to survive.",
'SE21':"I have been in contact with the principal, superintendent and school board. They all talk and no action.",
'SE22':"They don't care about tenants, alot of their low income housing have infestations.",
'SE23':"the answers seemed to change depending on who he talked to.",
'SE24':"My bathroom has mold that keeps growing back, and they swerve my every request for fixing that issue, too."
}
handles={
'SE01':'halfbakedpotential','SE02':'sadneighborhoodcat','SE03':'eugeneugene','SE04':'Dragon_slayer1994','SE05':'carp_street','SE06':'Bookbabble0064','SE07':'Bufus','SE08':'theblackdog92','SE09':'mr_roo','SE10':'Sir_Fox_Alot','SE11':'dand_theythem_hehim','SE12':'GrandDuchessMelody','SE13':'NightHawk_85','SE14':'19jordy84','SE15':'bifocalsexual','SE16':'StrengthBackground45','SE17':'Justredditin','SE18':'UnpopularOpinionYQR','SE21':'Queasy_Item618','SE22':'Ready_Swordfish1009','SE23':'rjd00d','SE24':'[deleted]'
}
permalinks={
'SE15':'https://www.reddit.com/r/saskatoon/comments/1okadn1/comment/nm9r6pu/',
'SE18':'https://www.reddit.com/r/saskatchewan/comments/1h412ln/comment/lzvwck0/',
'SE23':'https://www.reddit.com/r/saskatchewan/comments/1h412ln/comment/lzzul3k/',
'SE24':'https://www.reddit.com/r/saskatoon/comments/1m7s0ph/comment/n516ogp/'
}
parent_by_id={
'1pdkzpu':'https://www.reddit.com/r/saskatoon/comments/1pdkzpu/how_the_hell_am_i_supposed_to_find_childcare/',
'1thvze4':'https://www.reddit.com/r/saskatoon/comments/1thvze4/licensed_daycares/',
'1uf05hl':'https://www.reddit.com/r/saskatoon/comments/1uf05hl/saskatoon_no_longer_accepting_subsidized_daycare/',
'1okadn1':'https://www.reddit.com/r/saskatoon/comments/1okadn1/said_benefits_on_hold/',
'1h412ln':'https://www.reddit.com/r/saskatchewan/comments/1h412ln/i_feel_like_anyone_thats_on_disability_or_welfare/',
'1nk9vpy':'https://www.reddit.com/r/regina/comments/1nk9vpy/school_bullying/',
'1m7s0ph':'https://www.reddit.com/r/saskatoon/comments/1m7s0ph/saskatoon_housing_authority_experiences/'
}
records=[]
for old in source['observations']:
 id=old['id']
 if id not in quotes: continue
 url=permalinks.get(id,old['url'])
 thread=next(v for k,v in parent_by_id.items() if k in url)
 comment='/comment/' in url
 date_label=old.get('dateLabel') or (old['date']+' (thread date; comment day not verified)' if comment and 'comment date visible' not in old['datePrecision'] else old['date'])
 role='household' if id in {'SE10','SE18','SE21','SE22'} else ('advocate' if id=='SE23' else 'firsthand')
 role_details={
 'SE10':'Poster describes partner’s childcare-provider application; one account, not separate counts for partner or waitlist clients.',
 'SE18':'Poster describes extended-family experience; relatives are not separately counted.',
 'SE21':'Parent describes their own escalation about a child’s schooling.',
 'SE22':'Poster describes personal/professional contact and a relative’s apartment; one account.',
 'SE23':'Informal helper who assisted a friend with an application; not a professional or institutional spokesperson.',
 'SE24':'Tenant self-report; deleted account prevents deduplication.'
 }.get(id,'Self-reported experience accessing or navigating the service; identity and allegation not independently validated.')
 notes=[]
 if comment: notes.append('Author and exact excerpt verified on full parent thread. Comment permalink was exposed by Reddit timestamp link; direct comment fetch can fail, so parent link is retained.')
 else: notes.append('Visible post author and exact excerpt verified on original full-title Reddit thread.')
 if id=='SE24': notes=['Exact excerpt visible under [deleted]. Author unavailable; excluded from unique-author counts.']
 if id=='SE17': notes.append('Other commenters dispute the benefit rules described. Treat as a reported experience, not a statement of policy.')
 if id=='SE23': notes.append('The author corrects their program reference from SAID to SIS later in the same comment.')
 if id=='SE01': notes.append('A navigation/information pain point and request for help, not proof that a childcare place was refused.')
 if id in {'SE02','SE03','SE04','SE05','SE07','SE08','SE12','SE14','SE15'}: notes.append('See historical resolution/status in the existing research record; do not assume the issue remains open today.')
 records.append({'existingId':id,'platform':'Reddit','authorHandle':handles[id],'quote':quotes[id],'url':url,'sourcePage':thread,'date':old['date'],'dateLabel':date_label,'datePrecision':old['datePrecision'],'verification':' '.join(notes),'verifiedAt':'2026-11-25','sourceRole':role,'sourceRoleDetail':role_details,'countEligible':old['countEligible'],'quoteWordCount':len(quotes[id].split())})
coverage=[
 {'platform':'Reddit','status':'Verified','records':22,'countableAccounts':21,'scope':'Existing social/education/housing evidence: seven original threads; exact quotes and visible handles reviewed again on 2026-11-25.','limitation':'Purposive sample with Saskatoon concentration. Comment timestamps often relative; thread dates are context rather than exact event dates. Deleted account remains uncounted.'},
 {'platform':'X / Twitter','status':'Searched; no qualifying direct post verified','records':0,'queries':['site:x.com Saskatchewan SAID 2025','site:x.com "Saskatchewan" "SAID" "benefits"','site:twitter.com "Saskatchewan" "SAID"','site:x.com "Saskatchewan" "benefits" "caseworker"','site:x.com "Saskatoon" "daycare" "waitlist"'],'limitation':'Public web search did not surface an attributable, dated Saskatchewan social/education complaint post in these searches. No claim of zero complaints on X. No login/private data used.'},
 {'platform':'LinkedIn','status':'Searched; no qualifying Saskatchewan direct complaint verified','records':0,'queries':['site:linkedin.com/posts Saskatchewan childcare waitlist','site:linkedin.com/posts "Saskatchewan" "child care" "cuts"','site:linkedin.com/posts "Saskatchewan" "Social Services" "frustrating"','site:linkedin.com/posts "Saskatoon" "daycare" "government"','site:linkedin.com/posts "Saskatchewan" "educational assistants"','"Saskatchewan" "SAID" site:linkedin.com/posts/ -jobs -in/'],'excludedExamples':[{'url':'https://www.linkedin.com/posts/allisonkushner_ive-been-gaslit-by-managers-before-1010-activity-7396548489171705859-ZogZ','reason':'Childcare complaint surfaced, but Saskatchewan service/geography not established; excluded.'},{'url':'https://www.linkedin.com/posts/m%C3%A9tisnation-saskatchewan_strong-government-to-government-relationships-activity-7128805180501889025-BYxr','reason':'Institutional daycare-space announcement; not a complaint.'},{'url':'https://ca.linkedin.com/in/janessayeomans','reason':'A marketing post about generic phone-menu frustration, not a verified complaint about a Saskatchewan government service.'},{'url':'https://ca.linkedin.com/in/rayne-kelsey-73112a417','reason':'General childcare coaching commentary and promotion; no attributable provincial service complaint.'}],'limitation':'Searchability is incomplete; promotional, unrelated-geography and profile content were not converted into complainant counts.'},
 {'platform':'Quora','status':'Access limited','records':0,'queries':['site:quora.com Saskatchewan social assistance complaints','site:quora.com "Saskatchewan" "daycare"'],'limitation':'Tool returned robots.txt block for quora.com. No original answers, authors or dates verified; none counted.'}
]
result={'records':records,'newRecords':[],'coverage':coverage}
assert len(records)==22
assert sum(r['countEligible'] for r in records)==21
assert max(r['quoteWordCount'] for r in records)<=35
Path('work/social-education-evidence.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'records':len(records),'eligible':sum(r['countEligible'] for r in records),'maxQuoteWords':max(r['quoteWordCount'] for r in records),'newRecords':0}))
