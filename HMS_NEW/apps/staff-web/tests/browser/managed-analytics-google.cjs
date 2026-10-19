async page => {
  await page.setViewportSize({width:1440,height:900});
  if(await page.getByRole("button",{name:"Open workspace",exact:true}).isVisible())await page.getByRole("button",{name:"Open workspace",exact:true}).click();
  const checks=[];
  const assert=(value,message)=>{if(!value)throw new Error(message);checks.push(message);};
  const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  const zero={visitors:11,views:22,started:2,booked:0,sources:{google:7,maps:0,whatsapp:0,social:0,direct:4,other:0},devices:{mobile:8,desktop:3,tablet:0},clicks:{call:1,whatsapp:0,directions:0}};
  let sites=[],siteWrites=0;
  await page.route('**/v1/website-analytics**',async route=>{
    if(route.request().method()==='POST'){siteWrites++;const body=route.request().postDataJSON();sites=[{id:'01920000-0000-7000-8000-000000000999',url:body.url,kind:'own',status:'waiting',addedAt:Date.now(),code:'<script defer src="https://dashboard.example.com/a.js" data-site="01920000-0000-7000-8000-000000000999"></script>'}];return json(route,{id:sites[0].id});}
    return json(route,{v:1,available:true,status:sites.length?'ready':'not_started',provider:sites.length?'exora':null,posthog:null,posthogEnabled:true,switchedAt:null,sites,days:[{date:'2026-10-15',...zero}],pages:[{path:'/',title:'Home',share:100}],totals:zero,before:{...zero,visitors:3,views:4},bookingsTracked:false,breakdownsAvailable:true});
  });
  await page.getByRole('button',{name:'Website analytics',exact:true}).click();
  await page.getByRole('tab',{name:'Websites',exact:true}).click();
  await page.getByRole('button',{name:'Add a website',exact:true}).click();
  await page.getByLabel('Website address').fill('https://clinic.example.com');
  await page.getByRole('button',{name:'Add website',exact:true}).click();
  await page.getByText('clinic.example.com',{exact:true}).waitFor();
  assert(siteWrites===1,'Analytics add submits one API intent');
  assert(await page.getByText('Waiting for a visit',{exact:true}).count()===1,'Analytics installation waits for a real event');
  await page.getByRole('tab',{name:'Settings',exact:true}).click();
  assert(await page.getByText('Managed by Exora',{exact:true}).count()===1,'Analytics settings are company managed');
  assert(await page.getByLabel(/API key|Personal key|Project ID/).count()===0,'No customer provider credentials are requested');
  const overflow=[];
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);overflow.push(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth})));}
  assert(overflow.every(d=>d.scroll<=d.width),'Analytics settings fit desktop and 390px layouts');
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('tab',{name:'Overview',exact:true}).click();
  assert(await page.getByText('Bookings are not attributed to website visitors yet. A dash means unavailable.').count()===1,'Untracked conversion is explicit');
  await page.screenshot({path:'/tmp/hms-managed-analytics.png'});
  const fixture={v:1,available:true,status:'connected',version:1,account:{email:'Clinic team',listing:'Browser fixture clinic'},listing:{name:'Browser fixture clinic',phone:'+919876543210',website:'https://clinic.example.com',address:'Main street',primaryCategory:'Medical clinic',categories:[],description:'',hours:[],holidays:[],services:[],bookUrl:null,whatsappUrl:null,facts:{},social:{},photos:{logo:[],cover:[],outside:[],inside:[],team:[]}},checking:{},reviews:[{id:'review1',author:'Test reviewer',stars:5,text:'Helpful staff',at:Date.now(),reply:null}],posts:[],month:null,lastMonth:null,daily:[],keywords:[],googleChanges:[],askReviews:false,reviewUrl:null,capabilities:{profile:true,reviews:true,posts:true,photos:false,insights:false,reviewRequests:false}};
  let writes=0;
  await page.route('**/v1/google-business**',route=>{
    if(route.request().method()==='POST'){writes++;return json(route,{error:{code:'precondition_failed',message:'The connected service could not complete this request.'}},422);}
    if(route.request().url().includes('/performance'))return json(route,{status:'service_unavailable',current:null,previous:null,daily:[]});
    return json(route,fixture);
  });
  await page.getByRole('button',{name:'Google Business',exact:true}).click();
  await page.getByRole('tab',{name:/^Reviews/}).click();
  await page.getByRole('button',{name:'Reply',exact:true}).click();
  const boxes=page.locator('textarea');await boxes.first().fill('Thank you for your feedback.');
  const submit=page.getByRole('button',{name:/Publish reply|Send reply|Post reply/});
  if(await submit.count())await submit.first().click();else {const buttons=await page.getByRole('button').allTextContents();throw new Error('Find review submit button: '+buttons.join('|'));}
  await page.getByText('The connected service could not complete this request.',{exact:true}).waitFor();
  assert(writes===1,'Google reply uses one server action');
  assert(await page.getByText('Thank you for your feedback.',{exact:true}).count()===0,'Rejected provider reply is not shown as published');
  await page.screenshot({path:'/tmp/hms-managed-google.png'});
  assert((await page.evaluate(()=>Object.keys(localStorage).filter(k=>/exora:(analytics|google|whatsapp)/.test(k)))).length===0,'Connected integration state is not persisted in browser storage');
  return ({evidence:'Local browser with mocked integration responses; other workspace APIs are real local PostgreSQL.',checks,overflow});
}
