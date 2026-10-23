'use client';
import {useId,useRef,useState} from 'react';
import './showcase-pages.css';
export default function WorkflowSteps({steps,label}:{steps:{title:string;body:string}[];label:string}) {
 const [active,setActive]=useState(0);const id=useId();const refs=useRef<(HTMLButtonElement|null)[]>([]);
 function move(event:React.KeyboardEvent,index:number){let next=index;if(event.key==='ArrowRight')next=(index+1)%steps.length;else if(event.key==='ArrowLeft')next=(index-1+steps.length)%steps.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=steps.length-1;else return;event.preventDefault();setActive(next);refs.current[next]?.focus();}
 return <section className="showcase-workflow" aria-label={label}>
  <p className="showcase-kicker">{label}</p>
  <div role="tablist" aria-label={label}>{steps.map((step,index)=><button key={step.title} ref={el=>{refs.current[index]=el;}} type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={index===active} tabIndex={index===active?0:-1} onKeyDown={event=>move(event,index)} onClick={()=>setActive(index)}><span aria-hidden="true">0{index+1}</span>{step.title}</button>)}</div>
  {steps.map((step,index)=><div key={step.title} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={index!==active} tabIndex={0}><p>{step.body}</p></div>)}
 </section>;
}
