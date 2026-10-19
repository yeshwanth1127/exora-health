async page => {
  if(await page.getByRole("button",{name:"Open workspace",exact:true}).isVisible())await page.getByRole("button",{name:"Open workspace",exact:true}).click();
  let writes=0;
  const id='01920000-0000-7000-8000-000000000777';
  const message={id:'01920000-0000-7000-8000-000000000778',at:Date.now(),from:'patient',text:'Hello reception'};
  await page.route('**/v1/whatsapp-workspace**',async route=>{
    const u=new URL(route.request().url());
    if(route.request().method()==='POST'){writes++;return route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:{code:'precondition_failed',message:'Care consent is required.'}})});}
    if(u.pathname.includes('/conversations/'))return route.fulfill({contentType:'application/json',body:JSON.stringify({conversation:{id,version:1,canReply:true},messages:[{id:message.id,direction:'inbound',text:message.text,createdAt:new Date(message.at).toISOString(),actorStaffId:null,status:null}]})});
    const res=await route.fetch(),data=await res.json();
    Object.assign(data,{available:true,connected:true,capabilities:{sending:true,booking:false,automations:false,campaigns:false}});
    data.setup.connected={phone:'+919876543210',name:'Browser fixture clinic'};
    data.data.conversations=[{id,version:1,canReply:true,patient:'Test visitor',phone:'+919876543299',reason:'',status:'open',assignee:null,messages:[message],updatedAt:message.at,context:{next:null,last:null,visits:0}}];
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.getByRole('button',{name:'WhatsApp',exact:true}).click();
  await page.getByRole('tab',{name:/^Inbox/}).click();
  await page.getByLabel('Reply',{exact:true}).fill('Do not show this as delivered');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await page.getByText('Care consent is required.',{exact:true}).waitFor();
  if(writes!==1)throw Error('Reply submitted more than once');
  if(await page.getByText('Do not show this as delivered',{exact:true}).count())throw Error('Rejected reply displayed as sent');
  await page.screenshot({path:'/tmp/hms-managed-whatsapp.png'});
  return {evidence:'Local browser with mocked WhatsApp provider responses',checks:['Connected inbox renders','Reply submits one intent','Consent failure stays explicit','Rejected reply is not displayed as sent']};
}
