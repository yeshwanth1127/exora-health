import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import App from './App';
import {WebsiteRuntimeProvider} from './Runtime';
vi.mock('../components/sections/HospitalGallerySection',()=>({HospitalGallerySection:()=> <section aria-label="Photo gallery"/>}));
const profile={name:'River Hospital',city:'Pune',address:'Hospital Road, Pune',phone:'+912012345678',timezone:'Asia/Kolkata',content:{photos:[],packages:[],services:[],treatments:[],scans:[],insurers:[],faqs:[]},runtime:{template:'swastikaa',bookingSite:'river-hospital',facilityId:'facility-one',demoEnabled:false}};
const doctor={slug:'dr-published',name:'Dr Published',specialty:'Medicine',acceptsVirtual:false,qualifications:['MBBS'],languages:['English'],departments:['Medicine'],bio:'Published biography',experienceYears:12,photoUrl:null,websiteIds:[]};
const catalog={siteSlug:'river-hospital',clinicName:profile.name,timezone:profile.timezone,today:'2026-10-26',bookingUntil:'2026-11-26',doctors:[doctor]};
const calls:{url:string;options?:RequestInit}[]=[];
let catalogFails=false,enquiryFails=false;
beforeEach(()=>{history.replaceState({},'','/');calls.length=0;catalogFails=false;enquiryFails=false;Object.assign(window,{HMS_WEBSITE:{bookingSite:'river-hospital'}});vi.stubGlobal('scrollTo',vi.fn());vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,options?:RequestInit)=>{const url=String(input);calls.push({url,options});if(url==='/public/v1/website')return Response.json(profile);if(url.endsWith('/catalog'))return Response.json(catalog,{status:catalogFails?503:200});if(url.includes('/slots?'))return Response.json({timezone:profile.timezone,slots:[{startsAt:'2026-10-26T04:00:00Z',endsAt:'2026-10-26T04:15:00Z',feeMinor:80000,slotToken:'signed-token'}],unpricedSlots:[]});if(url.endsWith('/voice/config'))return Response.json({enabled:false});if(url.endsWith('/enquiries')){if(enquiryFails){enquiryFails=false;throw Error('Connection lost. Retry the same enquiry.')}return Response.json({id:'receipt-one',status:'received'},{status:201})}throw Error('Unexpected request: '+url)}))});
afterEach(()=>{delete (window as any).HMS_WEBSITE;vi.unstubAllGlobals()});
it('uses persisted identity and published slots without an appointment form or false confirmation',async()=>{
 history.replaceState({},'','/consultants/dr-published');render(<WebsiteRuntimeProvider><App/></WebsiteRuntimeProvider>);
 expect(await screen.findByRole('heading',{level:1,name:'Dr Published'})).toBeInTheDocument();expect(screen.getByRole('link',{name:'River Hospital home'})).toBeInTheDocument();expect(screen.queryByText('Dr Karthik Shah')).not.toBeInTheDocument();expect(document.querySelector('main form')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Choose Monday, 26 October'}));
 fireEvent.click(await screen.findByRole('button',{name:/09:30.*800/}));fireEvent.click(screen.getByRole('button',{name:'Continue with appointment assistant'}));
 expect(await screen.findByText(/Appointment assistant is not active yet/,{}, {timeout:10000})).toBeInTheDocument();expect(screen.getByText(/This selection has not been booked/)).toBeInTheDocument();expect(calls.some(c=>c.url.endsWith('/appointments'))).toBe(false);
});
it('shows catalog failures without substituting demo doctors',async()=>{
 catalogFails=true;history.replaceState({},'','/consultants?service=');render(<WebsiteRuntimeProvider><App/></WebsiteRuntimeProvider>);
 expect(await screen.findByRole('button',{name:'Reload published doctors'})).toBeInTheDocument();expect(screen.queryByText('Dr Karthik Shah')).not.toBeInTheDocument();expect(screen.getByRole('heading',{name:'No consultants match your search'})).toBeInTheDocument();
});
it('recovers an enquiry using the same body and idempotency key after a lost response',async()=>{
 enquiryFails=true;history.replaceState({},'','/contact');render(<WebsiteRuntimeProvider><App/></WebsiteRuntimeProvider>);await screen.findByRole('button',{name:'Send enquiry'});
 for(const [label,value] of [['Your name','Example Visitor'],['Email address','visitor@example.test'],['Your message','Which entrance?']])fireEvent.change(screen.getByRole('textbox',{name:label}),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:'Send enquiry'}));await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Send enquiry'}));
 expect(await screen.findByRole('heading',{name:'Enquiry received'})).toBeInTheDocument();const posted=calls.filter(c=>c.url.endsWith('/enquiries'));expect(posted).toHaveLength(2);expect(posted[0].options?.body).toBe(posted[1].options?.body);expect(posted[0].options?.headers).toEqual(posted[1].options?.headers);
});
