import {randomUUID} from 'node:crypto';

/** Keep provider selections separate from their editable display titles. */
export function bookingReply(message:any): {body:string; interaction:any|null} {
  const interactive=message.interactive;
  const selection=interactive?.button_reply??interactive?.list_reply;
  if (message.type==='interactive' && selection && typeof selection.id==='string' && selection.id.length<=200 && typeof selection.title==='string') {
    const control=selection.id.endsWith('.HUMAN')?'HUMAN':selection.id.endsWith('.STOP')?'STOP':selection.title;
    return {body:control.slice(0,3000),interaction:{type:'choice',id:selection.id}};
  }
  if(message.type==='interactive' && interactive?.type==='nfm_reply' && typeof interactive.nfm_reply?.response_json==='string' && interactive.nfm_reply.response_json.length<=4096){
    try{
      const data=JSON.parse(interactive.nfm_reply.response_json);
      if(typeof data.flow_token==='string' && data.flow_token.length<=200 && typeof data.patient_name==='string' && data.patient_name.length<=100)
        return {body:'Booking details submitted',interaction:{type:'form',token:data.flow_token,patientName:data.patient_name}};
    }catch{/* Invalid forms never become free-text booking instructions. */}
  }
  return {body:typeof message.text?.body==='string'?message.text.body.slice(0,3000):'[Unsupported message content]',interaction:null};
}

export function resolveBookingReply(interaction:any,state:any):string|undefined {
  if(interaction?.type==='choice' && typeof interaction.id==='string'){
    const prefix=`pw.${state.menuToken}.`;
    const command=interaction.id.startsWith(prefix)?interaction.id.slice(prefix.length):undefined;
    return command && state.menuCommands?.includes(command)?command:undefined;
  }
  if(interaction?.type==='form' && state.step==='name' && state.formToken && interaction.token===state.formToken) return interaction.patientName;
  return undefined;
}

type Option={command:string;title:string;description?:string};
/** Sri Lakshmi-style native choices; a static native Flow collects the patient name. */
export function bookingUi(state:any,body:string,metadata:any,image?:string) {
  state.menuToken=randomUUID();
  const row=(command:string,title:string,description?:string):Option=>({command,title,description});
  const reception=row('HUMAN','Reception'),restart=row('RESTART','Start again');
  let text=body.replace('Reply HUMAN if you need to change or cancel it.','Choose Reception to change or cancel this appointment.'),button='Choose an option',options:Option[]=[],list=false;
  switch(state.step){
    case 'menu':options=[row('BOOK_VISIT','Book appointment'),row('FIND_DOCTOR','View doctors'),reception];break;
    case 'consent':
      text=(body.includes('To book, reply YES')?body.split('To book, reply YES')[0]:'')+'Choose Book appointment to allow WhatsApp messages about this booking. Promotions are not included.';
      options=[row('YES','Book appointment'),reception,row('STOP','No thanks')];break;
    case 'reminders':text='Would you like appointment reminders? Promotions are not included.';options=[row('REMIND','With reminders'),row('SKIP','Booking only'),reception];break;
    case 'department':text='Choose a speciality.';list=true;button='Choose speciality';options=(state.choices??[]).map((d:string,i:number)=>row(String(i+1),d));if(state.hasMore)options.push(row('NEXT','More specialities'));break;
    case 'doctor':text='Choose your doctor.';list=true;button='View doctors';options=(state.choices??[]).map((d:any,i:number)=>row(String(i+1),d.name));if(state.hasMore)options.push(row('NEXT','More doctors'));break;
    case 'mode':text='Choose how you would like to visit.';options=[row('1','In person'),row('2','Video consultation'),restart];break;
    case 'slot':text=(state.choices?.length?'Choose an available time.':'No priced times are available in this range.')+' Your time is reserved only after confirmation.';list=true;button='Choose time';options=(state.choices??[]).map((s:any,i:number)=>row(String(i+1),new Intl.DateTimeFormat('en-IN',{timeZone:state.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(s.startsAt)),`Consultation ₹${(s.feeMinor/100).toFixed(2)}`));if(state.hasMore)options.push(row('NEXT','More times'));options.push(row('DATE','Choose another date'));break;
    case 'date':text='Choose your appointment date.';list=true;button='Choose date';options=(state.dateChoices??[]).map((d:string)=>row(d,d));if(state.moreDates)options.push(row('NEXT','Next week'));options.push(row('TIMES','Back to times'));break;
    case 'name':{
      if(!/^\d{5,40}$/.test(metadata.detailsFlowId??''))throw Error('Native booking details form is not configured');
      state.formToken=randomUUID();state.menuCommands=[];
      return {type:'flow',body:{text:(metadata.testMode?'TEST CHAT — ':'')+'Enter the patient name in the booking form. No medical records or symptoms are needed.'},action:{name:'flow',parameters:{flow_message_version:'3',flow_id:metadata.detailsFlowId,flow_token:state.formToken,flow_cta:'Enter patient details',flow_action:'navigate',mode:metadata.detailsFlowMode==='draft'?'draft':'published',flow_action_payload:{screen:'DETAILS'}}}};
    }
    case 'confirm':text=`Patient: ${state.name}\n${state.doctorName}, ${new Intl.DateTimeFormat('en-IN',{timeZone:state.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(state.selected.startsAt))}\n${state.mode==='virtual'?'Video consultation':'In person'} · ₹${(state.selected.feeMinor/100).toFixed(2)}\nConfirm your appointment below. No payment is collected in this chat.`;options=[row('CONFIRM','Confirm booking'),restart,reception];break;
    default:options=[row('BOOK','Book another visit'),reception];
  }
  if(list){
    // Seven choices leave room for paging, date navigation and returning to the start.
    if(options.length>9)throw Error('Booking menu exceeds WhatsApp row limits');
    if(!options.some(o=>o.command==='RESTART'))options.push(restart);
  }
  state.menuCommands=options.map(o=>o.command);
  text=(metadata.testMode?'TEST CHAT — ':'')+text.replace(/^TEST CHAT — /,'');
  if(text.length>1024)throw Error('Booking message exceeds WhatsApp body limit');
  if(list)return {type:'list',body:{text},action:{button,sections:[{title:'Appointments',rows:options.map(o=>({id:`pw.${state.menuToken}.${o.command}`,title:o.title.slice(0,24),...(o.description?{description:o.description.slice(0,72)}:{})}))}]}};
  return {type:'button',body:{text},...(image?{header:{type:'image',image:{link:image}}}:{}),action:{buttons:options.map(o=>({type:'reply',reply:{id:`pw.${state.menuToken}.${o.command}`,title:o.title.slice(0,20)}}))}};
}
