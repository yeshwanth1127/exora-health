import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import App from '../App';
import {createPublicBookingApi} from '../lib/publicBookingApi';
// Test data bindings independently of the previously verified private Arc runtime.
vi.mock('../arc-pro',()=>({ArcTeamShowcase:({people,onPersonSelect}:{people:{id:string;name:string}[];onPersonSelect:(p:unknown)=>void})=><div>{people.map(person=><button key={person.id} onClick={()=>onPersonSelect(person)}>{person.name}</button>)}</div>,ArcLightboxViewer:()=>null,ArcDateReel:()=>null}));
const runtime=window as Window&{HMS_WEBSITE?:{bookingSite:string}};
const doctor=(slug:string,name:string)=>({slug,name,specialty:'Medicine',acceptsVirtual:false,websiteIds:[],qualifications:[],bio:null,experienceYears:null,languages:[],photoUrl:null,departments:['Medicine']});
function fixture(name='NDR Hospital',slug='ndr-hospital',doctors=[doctor('dr-one','Dr One'),doctor('dr-two','Dr Two')]){
 const profile={name,organisation:name,slug,city:'Chennai',timezone:'Asia/Kolkata',address:'Hospital road, Chennai',phone:'+914412345678',content:{photos:[],packages:[]}};
 const catalog={siteSlug:slug,clinicName:name,timezone:'Asia/Kolkata',today:'2026-10-25',bookingUntil:'2026-11-25',doctors};
 const fetch=vi.fn(async(url:string)=>url==='/public/v1/website'?Response.json(profile):url===`/public/v1/booking/${slug}/catalog`?Response.json(catalog):new Response('{}',{status:404}));vi.stubGlobal('fetch',fetch);return {profile,catalog,fetch};
}
beforeEach(()=>{history.replaceState({},'','/');runtime.HMS_WEBSITE={bookingSite:'ndr-hospital'};vi.stubGlobal('scrollTo',vi.fn());sessionStorage.clear();});
afterEach(()=>{delete runtime.HMS_WEBSITE;vi.unstubAllGlobals();});
it.each([['NDR Hospital','ndr-hospital'],['Riverbend Medical Centre','riverbend']])('brands the whole template using saved %s details',async(name,slug)=>{
 runtime.HMS_WEBSITE={bookingSite:slug};fixture(name,slug);render(<App/>);
 expect(await screen.findByRole('link',{name:`${name} home`})).toBeInTheDocument();
 await waitFor(()=>expect(document.title).toBe(name));
 expect(screen.getByText(`${name}. Here for you and your family in Chennai.`)).toBeInTheDocument();
 expect(document.body.textContent).not.toMatch(/Sri Lakshmi|Welbeck|KR Puram|99017|Dr\. Sambashiva/);
 expect(document.querySelectorAll('img[src*="sri-lakshmi"]')).toHaveLength(0);
 fireEvent.click(screen.getByRole('link',{name:`About ${name}`,exact:true}));
 expect(await screen.findByRole('heading',{name:'Care, close to home.'})).toBeInTheDocument();
});
it('uses the selected tenant doctor slug for profile and booking routes',async()=>{
 const {fetch}=fixture();render(<App/>);
 fireEvent.click(await screen.findByRole('button',{name:'Dr Two',exact:true}));
 expect(screen.getByRole('link',{name:/View full profile/})).toHaveAttribute('href','/doctors/dr-two');
 fireEvent.click(screen.getByRole('button',{name:/Arrange a visit with Dr Two/}));
 await waitFor(()=>expect(location.pathname).toBe('/book/dr-two'));
 expect(await screen.findByLabelText('Doctor')).toHaveValue('dr-two');
 expect(fetch.mock.calls.every(([url])=>!url.includes('sri-lakshmi'))).toBe(true);
});
it('a fresh tenant has truthful empty doctors, packages and gallery states',async()=>{
 fixture('NDR Hospital','ndr-hospital',[]);render(<App/>);
 expect(await screen.findByText('The hospital has not published its online doctor list yet.')).toBeInTheDocument();
 expect(screen.queryByText('Dr One')).not.toBeInTheDocument();
 fireEvent.click(screen.getAllByRole('link',{name:'Health checks',exact:true})[0]);
 expect(await screen.findByText(/No health check packages are published here yet/)).toBeInTheDocument();
});
it('never silently uses the former hospital booking slug when runtime binding is missing',()=>{
 delete runtime.HMS_WEBSITE;
 expect(()=>createPublicBookingApi()).toThrow(/not configured correctly/);
});
it('does not replace unavailable saved branding with a fabricated name',async()=>{
 fixture();vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:503})));render(<App/>);
 expect(await screen.findByRole('heading',{name:'The hospital website is temporarily unavailable.'})).toBeInTheDocument();
 expect(screen.queryByText('NDR Hospital')).not.toBeInTheDocument();
});
it('uses only supplied package labels, inclusions and prices in the reused pricing rail',async()=>{
 const {profile,catalog}=fixture();
 const packages=[1,2,3,4].map(index=>({id:'check-'+index,name:'Published check '+index,description:'Hospital-supplied description '+index,priceMinor:index*12300,inclusions:['Published inclusion '+index]}));
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url==='/public/v1/website'?Response.json({...profile,content:{...profile.content,packages}}):Response.json(catalog)));
 render(<App/>);
 expect(await screen.findByText('Published check 1')).toBeInTheDocument();
 expect(screen.getByText('₹123.00')).toBeInTheDocument();expect(screen.getByText('Published inclusion 1')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'More checks',exact:true}));
 expect(screen.getByText('Published check 4')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Ask about this package',exact:true}));
 expect(await screen.findByRole('heading',{name:'Speak with NDR Hospital.'})).toBeInTheDocument();
 expect(location.search).toBe('?package=check-4');
 expect(document.body.textContent).not.toMatch(/Diabetic Check|Fertility Health|749|Sri Lakshmi/);
});
