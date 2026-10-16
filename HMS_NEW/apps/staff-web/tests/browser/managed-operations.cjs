async page => {
  const checks=[],assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  let active=false,activationWrites=0,releaseActivation;
  await page.route('**/v1/whatsapp-workspace**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname!=='/v1/whatsapp-workspace')return route.fallback();
    if(route.request().method()==='PUT'){
      activationWrites++;
      await new Promise(resolve=>{releaseActivation=resolve;});
      active=true;return json(route,{version:2});
    }
    const response=await route.fetch(),data=await response.json();
    Object.assign(data,{available:true,connected:true,version:active?2:1,capabilities:{sending:true,booking:true,automations:true,campaigns:true}});
    data.setup={...data.setup,connected:{phone:'+919876543210',name:'Browser fixture clinic'},live:active,paused:!active};
    data.data.bookingActive=active;data.data.bookedToday=2;return json(route,data);
  });
  let enabled=false,noticeWrites=0;
  const notice=()=>({kind:'confirmation',title:'Booking confirmation',body:'Your appointment at your clinic is confirmed for the appointment time.',enabled,status:'approved',version:enabled?2:1});
  await page.route('**/v1/whatsapp-workspace/automations**',async route=>{
    if(route.request().method()==='PUT'){noticeWrites++;enabled=route.request().postDataJSON().enabled;}
    return json(route,{items:[notice()]});
  });
  const id='01920000-0000-7000-8000-000000000123';let previews=0,approvals=0;
  await page.route('**/v1/whatsapp-workspace/promotions**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname.endsWith('/preview')){previews++;const b=route.request().postDataJSON();return json(route,{id,version:1,body:'Our clinic has extended opening hours.',recipients:3,estimateMinor:300,dueAt:b.dueAt});}
    if(u.pathname.endsWith('/approve')){approvals++;return json(route,{error:{code:'conflict',message:'The audience changed. Review the promotion again.'}},409);}
    return json(route,{available:true,templates:[{name:'private_provider_name',language:'en',body:'Our clinic has extended opening hours.'}],items:[]});
  });
  await page.goto('http://127.0.0.1:5199/staff/whatsapp?tab=overview');
  const login=page.getByRole('button',{name:'Open workspace',exact:true});if(await login.isVisible())await login.click();
  await page.getByText('Connected · booking paused',{exact:true}).waitFor();
  const request=page.waitForRequest(r=>r.method()==='PUT'&&new URL(r.url()).pathname==='/v1/whatsapp-workspace');
  await page.getByRole('switch',{name:'Accept bookings on WhatsApp'}).click();await request;
  assert(await page.getByText('Taking bookings',{exact:true}).count()===0,'Booking activation waits for server confirmation');
  releaseActivation();
  await page.getByText('Taking bookings',{exact:true}).waitFor();assert(activationWrites===1,'Booking activation submits one intent');
  await page.getByRole('tab',{name:'Automations',exact:true}).click();
  await page.getByRole('switch',{name:'Booking confirmation',exact:true}).click();
  await page.getByText('Ready',{exact:true}).waitFor();assert(noticeWrites===1,'Appointment notice toggle persists one intent');
  await page.getByRole('tab',{name:'Promotions',exact:true}).click();
  await page.getByLabel('Promotion name',{exact:true}).fill('Clinic news');
  await page.locator('select').last().selectOption('0');
  await page.getByLabel(/^Send after/).fill(new Date(Date.now()+86400000).toISOString().slice(0,16));
  await page.getByRole('button',{name:'Review promotion',exact:true}).click();
  await page.getByText('Review before sending',{exact:true}).waitFor();assert(previews===1,'Promotion requires a persisted preview');
  await page.getByRole('button',{name:'Approve and schedule',exact:true}).click();
  await page.getByText('The audience changed. Review the promotion again.',{exact:true}).waitFor();
  assert(approvals===1,'Promotion approval submits one intent');
  assert(await page.getByText('Review before sending',{exact:true}).count()===1,'Rejected promotion remains in review');
  assert(await page.getByText('Promotion scheduled.',{exact:true}).count()===0,'Rejected promotion is never shown as scheduled');
  assert(await page.getByLabel(/API key|Access token|App secret|Webhook/).count()===0,'Operations require no provider credentials from clinic staff');
  await page.setViewportSize({width:390,height:900});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Promotion review fits a 390px screen');
  await page.screenshot({path:'/tmp/hms-managed-operations.png'});
  return {evidence:'Local browser with injected managed responses; no real provider delivery',checks};
}
