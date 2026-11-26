from pathlib import Path
import argparse
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader
import pypdfium2 as pdfium

BASE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='Rebuild the historical two-page candidate Build Record.')
parser.add_argument('--output-dir',type=Path,default=BASE/'generated')
args=parser.parse_args()
args.output_dir.mkdir(parents=True,exist_ok=True)
OUT=args.output_dir/'Build-record.pdf'
INK=colors.HexColor('#163B35'); TEXT=colors.HexColor('#223A39'); MUTED=colors.HexColor('#536A67'); LINE=colors.HexColor('#D7E3DE'); PALE=colors.HexColor('#F0F6F3'); GOLD=colors.HexColor('#956623')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleX',fontName='Helvetica-Bold',fontSize=21,leading=24,textColor=INK,spaceAfter=8))
styles.add(ParagraphStyle(name='SubX',fontName='Helvetica',fontSize=9,leading=12,textColor=MUTED,spaceAfter=12))
styles.add(ParagraphStyle(name='H2X',fontName='Helvetica-Bold',fontSize=11,leading=14,textColor=INK,spaceBefore=9,spaceAfter=5))
styles.add(ParagraphStyle(name='BodyX',fontName='Helvetica',fontSize=9.4,leading=12.3,textColor=TEXT,spaceAfter=6))
styles.add(ParagraphStyle(name='SmallX',fontName='Helvetica',fontSize=8.2,leading=10.6,textColor=TEXT,spaceAfter=3))
styles.add(ParagraphStyle(name='TinyX',fontName='Helvetica',fontSize=7.7,leading=10,textColor=MUTED))
P=lambda t,style='BodyX':Paragraph(t,styles[style])

def section(t):return P(t,'H2X')
class Architecture(Flowable):
    def __init__(self):Flowable.__init__(self);self.width=499;self.height=132
    def draw(self):
        c=self.canv
        def box(x,y,w,h,title,lines):
            c.setStrokeColor(LINE);c.setFillColor(PALE);c.roundRect(x,y,w,h,5,fill=1,stroke=1)
            c.setFillColor(INK);c.setFont('Helvetica-Bold',8.5);c.drawString(x+9,y+h-15,title)
            c.setFillColor(TEXT);c.setFont('Helvetica',7.6)
            for i,line in enumerate(lines):c.drawString(x+9,y+h-28-i*10,line)
        box(0,54,155,72,'1  Discover the problem',['Public sources + curated JSON','28 concerns / 80 evidence records','Static dashboard + PDF briefs'])
        box(171,54,155,72,'2A  Prepare and review',['Applicant <-> Ministry forms','Shared browser localStorage','Same origin; export/import fallback'])
        box(342,54,155,72,'2B  Match and apply',['Family <-> Provider inbox','React -> local Node/Express API','SQLite saves applications/status'])
        c.setStrokeColor(GOLD);c.setDash(3,3);c.line(248,49,248,31);c.line(248,31,419,31);c.line(419,31,419,49);c.setDash()
        c.setFillColor(GOLD);c.setFont('Helvetica-Bold',7.8);c.drawCentredString(333,17,'PLANNED: approval -> provider registry / account')
        c.setFillColor(MUTED);c.setFont('Helvetica',7.4);c.drawString(0,0,'External: source links, real providers\' external application routes, OpenStreetMap tiles. No government API.')

def footer(c,doc):
    w,h=A4;c.setStrokeColor(LINE);c.line(48,42,w-48,42)
    c.setFillColor(MUTED);c.setFont('Helvetica',8);c.drawString(48,29,'Saskatchewan service improvement | Candidate prototype | 25 November 2026')
    c.drawRightString(w-48,29,str(doc.page))

story=[]
story += [P('Discover the friction. Connect the journey.','TitleX'),P('BUILD RECORD  /  Two-part submission across three application experiences','SubX')]
story += [section('Problem and intended outcome'),P('<b>Part 1:</b> turn scattered public complaints into traceable service-improvement hypotheses, with source context and careful counts. <b>Part 2:</b> help families find care and help prospective providers prepare complete applications that Ministry staff can review and correct efficiently. The intended service connects provider onboarding, licensing review, family applications, provider operations and conditional grant requests. Reduced delays, rework and avoidable incomplete submissions are hypotheses to test, not measured results.')]
story += [section('Architecture: implemented now and the next connection'),Architecture(),Spacer(1,5),P('<b>Current boundary:</b> the family/provider experience has a persistent local backend; the applicant/Ministry forms share browser storage. Those two stores are <b>not connected</b>. Ministry form acceptance does not issue a licence or create a provider account. AI helpers are labelled demonstrations using prepared examples and checklist results.','SmallX')]
story += [section('Choices and alternatives'),P('<b>Reuse details; correct specific answers.</b> One facility profile populates digital forms, while applicant, consultant and outside-issuer sections retain separate ownership. Shared edits reopen affected reviews. This addresses repeated typing and ambiguous correction requests; retaining upload-only questionnaires would preserve those problems.'),P('<b>Keep the prototype inspectable.</b> Static source-linked discovery and browser-based onboarding allow straightforward review; SQLite proves family/provider persistence and recipient isolation. A new shared production service was deferred until identities, approval transitions and operational ownership can be validated.'),P('<b>Separate licensing from funding.</b> Optional grant preparation does not block opening intake. The inventory maps 84 items: 37 forms, 28 external-evidence items, 4 tasks and 15 unavailable Ministry templates. Unknown templates and unconfirmed grant estimates remain explicit.')]
story += [section('AI-assisted build and human judgment'),P('<b>Tool:</b> OpenAI Codex assisted with public-source research, form inventories, UI/code generation, tests and packaging. Parallel agents checked the family, provider and complaint experiences. Human-directed review and executable tests determined what to retain.'),P('<b>Corrected AI-generated design:</b> the user challenged multiple sample applications in the applicant view and the requirement to upload completed questionnaires. The rebuild opens the applicant\'s own facility, makes another facility a deliberate action, and provides guided forms plus printable inspector copies. Source review also prevented blindly reproducing unconfirmed grant formulas. Runtime AI responses and automated licensing decisions are not claimed.')]
story += [PageBreak(),P('Evidence, limits and next steps','TitleX'),P('Verification refreshed for submission. Public-source research and fictional demonstration accounts only.','SubX')]
story += [section('Five representative checks: expected versus actual')]
rows=[[P('CHECK','SmallX'),P('EXPECTED','SmallX'),P('ACTUAL / EVIDENCE','SmallX')]]
cases=[
('1. Discovery inventory','Stable concern/evidence references and a shareable brief for every concern.','Static audit: 28 concerns, 80 evidence records and 28 PDFs. Sample counts distinguish 50 public accounts from 25 named people; they are not unique-resident totals. Public hosting was not freshly retested.'),
('2. Incomplete / conditional forms','Reject incomplete required submissions; keep unavailable later-stage templates from blocking intake.','Current provider suite: 14/14 passed, including atomic, phase-specific package validation and conditional required fields. Ministry/external-owned fields remain separate.'),
('3. Correction and review history','Retain prior answers, record the requested correction, and reopen affected reviews when shared data changes.','Provider tests passed for revision snapshots, submitted diffs, ownership boundaries and review reopening. Form acceptance records review only, not a licence or grant award.'),
('4. Consent and recipient access','Reject missing consent, stale/duplicate submissions and access by the wrong recipient.','Family suite: 11/11 passed. Missing consent: 400; stale/duplicate: 409; wrong provider/family: 404; provider requesting family profile: 403. Only the selected child is shared.'),
('5. Persistence and withdrawal','Persist saved applications; keep profile edits private until reshared; revoke provider access after withdrawal.','Database reopen retained records. Provider kept 08:00 after private edit to 09:00; explicit reshare changed it to 09:00. Withdrawal returned null profile/empty history and blocked messages.')]
for a,b,d in cases:rows.append([P(a,'SmallX'),P(b,'SmallX'),P(d,'SmallX')])
t=Table(rows,colWidths=[101,169,229],hAlign='LEFT')
t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),0.7,LINE),('LINEBELOW',(0,1),(-1,-1),0.4,LINE),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
story += [t,P('Test evidence: current forms-model.test.cjs (14 passed) and family tests/backend.test.js (11 passed). The family HTTP test first hit a local port permission restriction; the full suite passed after permission. Prior UI checks are recorded in QA notes; no new full browser regression is claimed.','TinyX')]
story += [section('Governance and pilot controls'),P('<b>Prototype boundary:</b> no production authentication, government integration, secure document repository, real notifications, licence issuance or grant payment. Demo account switching is intentional and must be replaced before real users. Real catalogue listings use external contact/application routes; connected providers are fictional. Public accounts are evidence signals, not verified people or a representative survey.','SmallX'),P('<b>Before real data:</b> the Ministry service owner confirms rules and forms; privacy/security leads approve purpose, consent, retention, hosting, role access and audit controls; an accessibility lead validates assisted and accessible routes. Keep human decisions for suitability, licensing, funding and exceptions. Any live AI requires a defined data boundary, grounded sources and reviewable output.','SmallX')]
story += [section('Next pilot: owners, support and measurable outcomes'),P('<b>Service owner + casework lead:</b> validate one provider pathway and the handoff from approval to an active provider record. <b>Engineering/security:</b> connect stores through stable facility IDs, authenticated roles, versioned status events and verified document storage. <b>Provider/family leads:</b> test receipt, correction and withdrawal with consented participants. <b>Operations:</b> assign a support owner, manual fallback, incident escalation and rollback procedure.','SmallX'),P('Baseline and compare: first-pass completeness, correction rounds per application, time to review/decision, reviewer minutes per case, family submission-to-acknowledgment time, withdrawal/access failures and accessibility task completion. Review weekly; expand only after owners approve the results. Defer province-wide registry coverage, real notifications, validated grant workflows and live AI until this narrow pilot is reliable.','SmallX')]

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=42,bottomMargin=54,title='Saskatchewan Service Improvement - Build Record',author='Candidate submission')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
r=PdfReader(str(OUT));print('pages',len(r.pages));assert len(r.pages)==2
pdf=pdfium.PdfDocument(str(OUT))
for i in range(len(pdf)):
    img=pdf[i].render(scale=1.4).to_pil();img.save(args.output_dir/f'build-record-page-{i+1}.png')
print(OUT)
