"""Render complete complaint briefs as downloadable, searchable PDFs."""
import json
import sys
from html import escape
from pathlib import Path
import reportlab
from reportlab import rl_config
rl_config.invariant=1
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

font_dir=Path(reportlab.__file__).parent/'fonts'
pdfmetrics.registerFont(TTFont('Brief',str(font_dir/'Vera.ttf')))
pdfmetrics.registerFont(TTFont('BriefBold',str(font_dir/'VeraBd.ttf')))
pdfmetrics.registerFontFamily('Brief',normal='Brief',bold='BriefBold',italic='Brief',boldItalic='BriefBold')
ink=colors.HexColor('#173626'); muted=colors.HexColor('#5C6B60'); line=colors.HexColor('#CAD8C4')
styles=getSampleStyleSheet()
for name,size,leading,color in [('Body',9.2,14,ink),('Small',7.6,11,muted),('Quote',11,16,ink),('Heading',16,21,ink),('Subheading',11,16,ink),('TitleCustom',25,31,ink)]:
    styles.add(ParagraphStyle(name,fontName='BriefBold' if name in ['Heading','Subheading','TitleCustom'] else 'Brief',fontSize=size,leading=leading,textColor=color,spaceAfter=7,alignment=TA_LEFT,splitLongWords=True,keepWithNext=name in ['Heading','Subheading','TitleCustom']))

def p(text,style='Body'):
    return Paragraph(escape(str(text or 'Not recorded')).replace('\n','<br/>'),styles[style])
def label(name,text):
    return Paragraph('<b>'+escape(name)+':</b> '+escape(str(text or 'Not recorded')).replace('\n','<br/>'),styles['Body'])
def link(title,url):
    safe=escape(url,quote=True)
    return Paragraph(escape(title)+': <link href="'+safe+'" color="#78521E">'+escape(url)+'</link>',styles['Small'])

packets=json.loads(Path(sys.argv[1]).read_text())
target=Path(sys.argv[2]);target.mkdir(parents=True,exist_ok=True)
for brief in packets:
    i=brief['issue']; c=brief['counts']; r=brief['route']; ref=i['referenceId']
    story=[p(ref+' · INTERNAL COMPLAINT BRIEF','Small'),p(i['concern'],'TitleCustom'),p(i['why']),p(f"Review period {brief['period']['start']} to {brief['period']['end']} · Sources reviewed {brief['reviewedAt']}",'Small'),Spacer(1,5*mm),p('Concern and evidence','Heading'),p(i['summary'])]
    metrics=[[p(str(c['publicAccounts']),'Heading'),p(str(c['namedInReporting']),'Heading'),p(str(c['evidenceRecords']),'Heading'),p(str(c['uncountedRecords']),'Heading')],[p('Public accounts','Small'),p('Named in reporting','Small'),p('Evidence records','Small'),p('Excluded records','Small')]]
    table=Table(metrics,colWidths=[43*mm]*4)
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#EFF4EA')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,0),10),('BOTTOMPADDING',(0,1),(-1,1),10)]))
    story += [table,Spacer(1,3*mm),p(f"{c['sourcePages']} source pages. Account and reporting counts are separate and may overlap. This brief contains every collected record for this concern, regardless of dashboard filters.",'Small'),Spacer(1,4*mm),p('Responsible ministry and service','Heading'),label('Ministry / oversight',i['ministry']),label('Service',i['service'])]
    if r:
        story += [label('First contact',r['first']),label('Escalation / responsibility',r['escalation']),label('Routing context',r.get('note',''))]
        story += [link(l['title'],l['url']) for l in r['links']]
    story += [Spacer(1,4*mm),p('AI assessment and proposed action','Heading')]
    for name,key in [('Assessment','fit'),('Opportunity / first intervention','idea'),('What AI cannot fix','limit'),('First step','firstStep'),('Success measure','measure'),('Why this starting point','reason')]:
        value={'assist':'AI could help','mixed':'AI + service change','service':'Service / policy fix'}.get(i[key],i[key])
        story.append(label(name,value))
    story += [p('Proposed investigation, not an approved project or promise of results. Ordering is not a ranking of harm or population prevalence.','Small'),PageBreak(),p('All source evidence','Heading'),p(f"{c['evidenceRecords']} records. Quotes document an expressed concern, not a verified finding of service failure. Reporting summaries are labelled separately.",'Small')]
    for e in brief['evidence']:
        date=e.get('dateLabel') or e.get('date') or 'Calendar date unverified'
        header=f"{e['referenceId']} · {e['platform']} · {e['sourceRole']}"
        story += [Spacer(1,4*mm),p(header,'Subheading'),p(f"{e.get('authorHandle') or e['authorId']} · {date} · {e.get('datePrecision','')}",'Small')]
        if e.get('quote'):story.append(p('“'+e['quote']+'”','Quote'))
        story += [p(e['summary']),label('Status at source review',e['status']),label('Context',e.get('context') or 'No additional context recorded.')]
        if not e['counted']:
            counted='Excluded. '+(e.get('exclusionReason') or ('Author cannot be uniquely attributed.' if e.get('date') else 'Calendar date unverified.'))
        else:counted='Named person in reporting; counted separately from public accounts.' if e['authorType']=='person' else 'Public account; counted once per concern.'
        story += [label('Count treatment',counted),label('Verification',e.get('verification') or 'Named testimony in reporting; underlying experience not independently verified.'),p(f"Account / person: {e['authorId']} · Original record: {e['id']} · Incident: {e['caseId']} · Region: {e.get('region','Not specified')}",'Small'),p('Source checked: '+(e.get('verifiedAt') or 'Individual check date not recorded; included in reviewed snapshot.'),'Small'),link(e['sourceTitle']+' · '+e['publisher'],e['url'])]
        if e.get('sourcePage') and e['sourcePage']!=e['url']:story.append(link('Full discussion',e['sourcePage']))
    story += [PageBreak(),p('Counting and interpretation','Heading')]
    for note in brief['methodology']:story.append(p('• '+note))
    story += [Spacer(1,4*mm),p('Review-wide coverage and limitations','Heading'),p('These platform totals cover the entire research review, not just this concern.','Small'),p(brief['researchContext']['scopeNote'])]
    for platform in brief['researchContext']['platformCoverage']:story.append(label(platform['platform'],platform['note']))
    for note in brief['researchContext']['limitations']:story.append(p('• '+note))
    story += [Spacer(1,5*mm),p(brief['publicationNote'],'Small'),p('Reference '+ref+' when discussing this concern. Share the complete document so evidence and context travel together.','Small')]
    def footer(canvas,doc):
        canvas.saveState();canvas.setStrokeColor(line);canvas.line(19*mm,17*mm,191*mm,17*mm);canvas.setFont('Brief',7);canvas.setFillColor(muted);canvas.drawString(19*mm,12*mm,ref+' · Public-source research');canvas.drawRightString(191*mm,12*mm,'Page '+str(doc.page));canvas.restoreState()
    doc=SimpleDocTemplate(str(target/(ref+'.pdf')),pagesize=A4,rightMargin=19*mm,leftMargin=19*mm,topMargin=18*mm,bottomMargin=23*mm,title=i['concern'],author='Independent public-source research',pageCompression=1)
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(f'Rendered {len(packets)} complete complaint PDFs.')
