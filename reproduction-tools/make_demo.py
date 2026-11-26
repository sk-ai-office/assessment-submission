from pathlib import Path
import subprocess,json,re,concurrent.futures,argparse,shutil,tempfile
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='Rebuild the narrated screenshot walkthrough; requires macOS speech synthesis.')
parser.add_argument('--output-dir',type=Path,default=ROOT/'generated')
parser.add_argument('--voice',default='Samantha')
parser.add_argument('--rate',type=int,default=160)
parser.add_argument('--font',default='/System/Library/Fonts/Supplemental/Arial.ttf')
args=parser.parse_args()
BASE=args.output_dir;BASE.mkdir(parents=True,exist_ok=True)
TEMP=Path(tempfile.mkdtemp(prefix='childcare-video-'))
SRC=ROOT/'assets'
FFMPEG=shutil.which('ffmpeg');FFPROBE=shutil.which('ffprobe');SAY=shutil.which('say')
if not all([FFMPEG,FFPROBE,SAY]):raise SystemExit('Install ffmpeg/ffprobe and run on macOS with the say command available.')
if not Path(args.font).is_file():raise SystemExit('Font missing: supply --font with the path to Arial or another installed font.')
scenes=[
('1  Discover the service problem','complaint-sharing-preview.jpg','This submission connects two ideas: discover service problems, then improve the child care journey. The complaints dashboard organizes twenty-eight concerns and eighty evidence records, with source context and shareable briefs. These are findings from a reviewed public-source sample. They are not provincial statistics, and public accounts are not verified individuals.'),
('2  Help providers prepare a complete application','childcare-applicant-preview.jpg','The provider applicant dashboard opens one facility application. Shared details are reused across guided digital forms. A clear next step and completeness checks help applicants address missing answers before review. Outside reports and required originals keep their own handling. Optional grant forms support preparation; they do not issue funding.'),
('3  Review answers and resolve corrections','childcare-ministry-preview.jpg','The Ministry view opens the submitted answers. Reviewers can request a correction to a specific field. The applicant updates and resubmits that answer, and review history is retained. Consultant notes remain separate from applicant responses. Accepting a form records review only. It does not issue a licence or approve a grant.'),
('4  Help families find suitable care','family-dashboard/desktop-search.jpg','Families can search and compare providers against their child, requested start date and care schedule. The map and results stay connected. Researched real listings link to external provider application or contact routes. Two fictional providers demonstrate the connected application workflow without sending information to real providers.'),
('5  Share with consent; receive a provider response','family-dashboard/application-review.jpg','For a connected example provider, the family reviews the selected child\'s details and explicitly consents to sharing. The provider receives that application and can acknowledge receipt or update its status. The family sees the response and history. A confirmed waiting-list place is not a guaranteed care space. Profile edits remain private until reshared, and withdrawal revokes provider access.'),
('6  Connect the next stage, with clear boundaries','childcare-applicant-preview.jpg','The family and provider workflow persists in a local database. Applicant and Ministry forms use browser storage, and these systems are not connected yet. The next stage links verified onboarding approval to an active provider account. AI helpers remain labelled demonstrations. Twenty-five current provider and family tests passed. Explore all three prototypes and the build record through the submission link. The goal is less retyping, more complete applications and faster human review.')]
font=args.font
def run(args):return subprocess.run(args,check=True,capture_output=True,text=True)
def stamp(sec):
    h=int(sec//3600);m=int(sec%3600//60);s=int(sec%60);ms=int((sec-int(sec))*1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'
def make(i,scene):
    title,img,speech=scene
    txt=TEMP/f'{i}.txt';txt.write_text(speech)
    au=TEMP/f'{i}.aiff';run([SAY,'-v',args.voice,'-r',str(args.rate),'-f',str(txt),'-o',str(au)])
    info=json.loads(run([FFPROBE,'-v','quiet','-show_format','-of','json',str(au)]).stdout)
    duration=float(info['format']['duration'])+0.6
    subs=[];current=0
    words=speech.split();groups=[]
    for j in range(0,len(words),12):groups.append(' '.join(words[j:j+12]))
    for n,g in enumerate(groups):
        end=(sum(len(x.split()) for x in groups[:n+1])/len(words))*(duration-0.6)
        subs.append(f'{n+1}\n{stamp(current)} --> {stamp(end)}\n{g}\n');current=end
    sub=TEMP/f'{i}.srt';sub.write_text('\n'.join(subs));titlefile=TEMP/f'{i}-title.txt';titlefile.write_text(title)
    out=TEMP/f'{i}.mp4'
    vf=f"scale=1280:552:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:78:color=0x133D35,drawtext=fontfile={font}:textfile={titlefile}:fontcolor=white:fontsize=27:x=30:y=18,drawtext=fontfile={font}:text='Narrated prototype walkthrough - actual screenshots':fontcolor=0xb8d5ca:fontsize=17:x=30:y=53,subtitles={sub}:force_style='FontName=Arial,FontSize=13,PrimaryColour=&HFFFFFF&,OutlineColour=&H10201D&,BorderStyle=3,Outline=1,Shadow=0,MarginV=6'"
    run([FFMPEG,'-y','-v','error','-loop','1','-framerate','12','-i',str(SRC/img),'-i',str(au),'-t',str(duration),'-vf',vf,'-c:v','libx264','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-r','12','-c:a','aac','-b:a','96k','-ar','48000','-af','apad','-movflags','+faststart',str(out)])
    return i,duration,out
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:results=sorted(ex.map(lambda item:make(*item),enumerate(scenes)))
concat=TEMP/'concat.txt';concat.write_text('\n'.join(f"file '{p}'" for i,d,p in results))
final=BASE/'Childcare-prototype-walkthrough.mp4';run([FFMPEG,'-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(final)])
(BASE/'Voiceover-transcript.txt').write_text('Narrated prototype walkthrough using actual screenshots. Synthetic speech. No filmed click interactions.\n\n'+'\n\n'.join(t+'\n'+speech for t,img,speech in scenes))
info=json.loads(run([FFPROBE,'-v','quiet','-show_format','-show_streams','-of','json',str(final)]).stdout)
print(json.dumps({'file':str(final),'seconds':info['format']['duration'],'bytes':final.stat().st_size,'streams':[(x['codec_type'],x['codec_name']) for x in info['streams']],'scenes':[{'scene':i+1,'duration':d} for i,d,p in results]}))
for t in [8,40,100]:run([FFMPEG,'-y','-v','error','-ss',str(t),'-i',str(final),'-frames:v','1',str(TEMP/f'frame-{t}.jpg')])

print('Intermediate audio, clips and inspection frames:',TEMP)
