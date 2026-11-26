import {useState} from 'react';
import {ShieldCheck,Send} from 'lucide-react';
import {Modal,Button,Notice,Field} from './ui';
import {dateLabel,timeLabel,ageLabel,monthsAt,matchProvider} from './domain';
export default function ApplicationReview({provider,profile,initialChildId,onClose,onSubmit,update=false}) {
  const [childId,setChild]=useState(initialChildId||profile.children[0].id),[consent,setConsent]=useState(false),[shareNotes,setShareNotes]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const c=profile.children.find(c=>c.id===childId);
  const match=matchProvider(provider,c,c.startDate);
  async function submit(){setError('');setBusy(true);try{await onSubmit({providerId:provider.id,childId,consent,shareNotes,profileVersion:profile.version});}catch(e){setError(e.message);setBusy(false);}}
  return <Modal title={update?'Review profile update':'Review your application'} onClose={onClose} footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button primary disabled={!consent||busy||(!update&&!match.ageFit)} onClick={submit}><Send/>{busy?'Sending…':update?'Share updated profile':'Send application'}</Button></>}>
    <p className="review-recipient">Sharing with <strong>{provider.name}</strong></p><p className="muted small">Example provider · local pilot only</p>{error&&<Notice error>{error}</Notice>}
    {!update&&profile.children.length>1&&<Field label="Child applying"><select value={childId} onChange={e=>{setChild(e.target.value);setConsent(false);setShareNotes(false);}}>{profile.children.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
    {!match.ageFit&&<Notice error>This child is outside the provider’s listed age range on the requested start date.</Notice>}
    {!match.scheduleFit&&<p className="mismatch">The listed hours do not cover your full schedule. Discuss this with the provider before accepting a space.</p>}
    <section className="review-block"><h3>Child and care schedule</h3><dl className="facts"><div><dt>Child</dt><dd>{c.name}</dd></div><div><dt>Birth date</dt><dd>{dateLabel(c.dob)}</dd></div><div><dt>Requested start</dt><dd>{dateLabel(c.startDate)}{c.flexible?' · Flexible':''}<small>{ageLabel(monthsAt(c.dob,c.startDate))} at start</small></dd></div><div><dt>Schedule</dt><dd>{c.days.join(', ')}<small>{timeLabel(c.startTime)}–{timeLabel(c.endTime)}</small></dd></div></dl></section>
    <section className="review-block"><h3>Contact details</h3><p>{profile.name}<br/>{profile.email}{profile.phone&&<><br/>{profile.phone}</>}<br/>{profile.postalCode}</p><p className="muted small">Preferred contact: {profile.preferredContact}</p></section>
    {c.notes&&<section className="review-block"><label className="check-label"><input type="checkbox" checked={shareNotes} onChange={e=>{setShareNotes(e.target.checked);setConsent(false);}}/>Include my optional support or care notes</label>{shareNotes?<p className="quoted-note">{c.notes}</p>:<p className="muted small">Your notes will not be shared.</p>}</section>}
    <div className="sharing-explanation"><ShieldCheck/><p>Only this child’s profile and the contact details above will be shared. Your other children are not included. You can withdraw access from My applications.</p></div>
    <label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I have reviewed these details and agree to share them with this provider.</label><p className="muted small">{update?'This replaces the profile copy attached to this application.':'Sending an application does not reserve a care space. The provider must confirm receipt and waitlist acceptance.'}</p>
  </Modal>;
}
