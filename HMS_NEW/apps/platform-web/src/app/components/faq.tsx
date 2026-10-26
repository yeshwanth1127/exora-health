'use client';
import {useId,useState} from 'react';
import {Plus} from 'lucide-react';
import './faq.css';
export type FaqItem={q:string;a:string};
/** Content stays in the HTML; only disclosure state changes on the client. */
export function FaqList({items}:{items:FaqItem[]}){
 const id=useId();const [expanded,setExpanded]=useState<Record<string,boolean>>({});const [instant,setInstant]=useState(false);
 return <div className="site-faq-list" data-instant={instant}>{items.map((item,index)=>{const open=Boolean(expanded[item.q]);return <article className="site-faq-item" data-open={open} key={item.q}>
  <h3><button type="button" id={`${id}-question-${index}`} aria-expanded={open} aria-controls={`${id}-answer-${index}`} onClick={event=>{setInstant(event.detail===0);setExpanded(current=>({...current,[item.q]:!current[item.q]}));}}><span>{item.q}</span><span className="site-faq-plus" aria-hidden="true"><Plus size={18} strokeWidth={1.7}/></span></button></h3>
  <div className="site-faq-answer" id={`${id}-answer-${index}`} role="region" aria-labelledby={`${id}-question-${index}`} aria-hidden={!open} inert={!open}><div><p>{item.a}</p></div></div>
 </article>;})}</div>;
}
export default function FaqSection({items,title='Questions, answered.',intro='A few useful details before you get started.',id,className=''}:{items:FaqItem[];title?:string;intro?:string;id:string;className?:string}){
 return <section className={`site-faq ${className}`} aria-labelledby={id}><header className="site-faq-heading"><p className="site-faq-eyebrow">Good to know</p><h2 id={id}>{title}</h2><p>{intro}</p></header><FaqList items={items}/></section>;
}
