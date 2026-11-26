import {useEffect,useRef} from 'react';
import {X,CheckCircle2,AlertCircle} from 'lucide-react';
export function Button({children,primary=false,quiet=false,className='',...props}){return <button className={`button ${primary?'primary':''} ${quiet?'quiet':''} ${className}`} {...props}>{children}</button>;}
export function Field({label,hint,children,className=''}){return <label className={`field ${className}`}><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Notice({children,error=false}){return <div className={`notice ${error?'error':''}`} role={error?'alert':'status'}>{error?<AlertCircle2/>:<CheckCircle2/>}<div>{children}</div></div>;}
function AlertCircle2(){return <AlertCircle/>;}
export function Modal({title,children,onClose,wide=false,drawer=false,footer}) {
  const ref=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{const el=ref.current,prior=document.activeElement;el.showModal();const cancel=e=>{e.preventDefault();close.current();};el.addEventListener('cancel',cancel);const bodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{el.removeEventListener('cancel',cancel);el.close();document.body.style.overflow=bodyOverflow;prior?.focus?.();};},[]);
  return <dialog ref={ref} className={`modal ${wide?'wide':''} ${drawer?'drawer':''}`} aria-labelledby="dialog-title" onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <header className="modal-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X/></button></header><div className="modal-body">{children}</div>{footer&&<footer className="modal-footer">{footer}</footer>}
  </dialog>;
}
export function Empty({title,children,action}){return <section className="empty"><h2>{title}</h2><p>{children}</p>{action}</section>;}
export function ErrorBoundaryFallback({message}){return <div className="boot-error"><h1>Let’s get you back to finding care</h1><p>{message}</p><Button onClick={()=>location.reload()}>Try again</Button></div>;}
