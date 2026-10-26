import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import App from '../App';
import {createPublicBookingApi} from '../lib/publicBookingApi';
vi.mock('../arc-pro',()=>({ArcTeamShowcase:({people,onPersonSelect}:{people:{id:string;name:string}[];onPersonSelect:(p:unknown)=>void})=><div>{people.map(p=><button key={p.id} onClick={()=>onPersonSelect(p)}>{p.name}</button>)}</div>,ArcLightboxViewer:()=>null,ArcDateReel:()=>null}));
const runtime=window as Window&{HMS_WEBSITE?:{bookingSite:string}};
const doctor=(slug:string,name:string)=>({slug,name,specialty:'Medicine',acceptsVirtual:false,websiteIds:[],qualifications:[],bio:null,experienceYears:null,languages:[],photoUrl:null,departments:['Medicine']});
function fixture(name='Test Hospital',doctors=[doctor('dr-one','Dr One'),doctor('dr-two','Dr Two')],content={}){
 const profile={name,organisation:name,slug:'test-hospital',city:'Bengaluru',timezone:'Asia/Kolkata',address:'',phone:'',content:{photos:[],packages:[],...content}};
 const catalog={siteSlug:'test-hospital',clinicName:name,timezone:'Asia/Kolkata',today:'2026-10-25',bookingUntil:'2026-11-25',doctors};
 const fetch=vi.fn(async(url:string)=>url==='/public/v1/website'?Response.json(profile):url.endsWith('/catalog')?Response.json(catalog):new Response('{}',{status:404}));vi.stubGlobal('fetch',fetch);return {profile,catalog,fetch};
}
beforeEach(()=>{history.replaceState({},'','/');runtime.HMS_WEBSITE={bookingSite:'test-hospital'};vi.stubGlobal('scrollTo',vi.fn());sessionStorage.clear();});
afterEach(()=>{delete runtime.HMS_WEBSITE;vi.unstubAllGlobals();});
it.each(['Swastikaa Hospital','Riverbend Medical Centre'])('uses saved %s branding throughout the Ditto-derived page',async(name)=>{
 fixture(name,[]);render(<App/>);expect(await screen.findByRole('link',{name:`${name} home`})).toBeInTheDocument();await waitFor(()=>expect(document.title).toBe(name));expect(screen.getByRole('heading',{name:`Get to know ${name}.`})).toBeInTheDocument();expect(document.body.textContent).not.toMatch(/Sri Lakshmi|Welbeck|St John|London|KR Puram|NDR Hospital/);
 for(const heading of ['Get to know your doctor.','Plan your visit.','Understand your cover. Before your visit.','Make room for your health.','Before you visit.'])expect(screen.getByRole('heading',{name:heading})).toBeInTheDocument();
});
it('binds the Arc-selected doctor to the profile and real booking route',async()=>{
 const {fetch}=fixture();render(<App/>);fireEvent.click(await screen.findByRole('button',{name:'Dr Two',exact:true}));expect(screen.getByRole('link',{name:'View doctor profile ↗'})).toHaveAttribute('href','/doctors/dr-two');fireEvent.click(screen.getByRole('button',{name:'See appointment times ↗'}));await waitFor(()=>expect(location.pathname).toBe('/book/dr-two'));expect(await screen.findByLabelText('Doctor')).toHaveValue('dr-two');expect(fetch.mock.calls.every(([url])=>!url.includes('sri-lakshmi'))).toBe(true);
});
it('does not invent doctors, insurers, prices or contact details for a fresh tenant',async()=>{
 fixture('Test Hospital',[]);render(<App/>);expect(await screen.findByText(/Verified doctor profiles/)).toBeInTheDocument();expect(screen.getByText(/Accepted insurers and cashless arrangements are awaiting verification/)).toBeInTheDocument();expect(screen.queryByText('Dr One')).not.toBeInTheDocument();expect(document.querySelector('a[href^="tel:"]')).toBeNull();expect(document.body.textContent).not.toContain('₹');fireEvent.click(screen.getByRole('link',{name:'Explore health plans ↗'}));expect(await screen.findByText(/No health check packages are published/)).toBeInTheDocument();
});
it('shows supplied plan inclusions and carries the chosen plan into the contact route',async()=>{
 fixture('Test Hospital',[],{packages:[{id:'check-one',name:'Published check',description:'Supplied description',priceMinor:12300,inclusions:['Published inclusion']}]});render(<App/>);expect(await screen.findByText('Published check')).toBeInTheDocument();expect(screen.getByText('₹123')).toBeInTheDocument();expect(screen.getByText('Published inclusion')).toBeInTheDocument();fireEvent.click(screen.getByRole('link',{name:'Enquire ↗'}));expect(await screen.findByRole('heading',{name:'Speak with Test Hospital.'})).toBeInTheDocument();expect(location.search).toBe('?package=check-one');
});
it('closes the menu with Escape and returns focus to its toggle',async()=>{
 fixture();render(<App/>);await screen.findByRole('link',{name:'Test Hospital home'});fireEvent.click(screen.getByRole('button',{name:'Menu'}));expect(screen.getByRole('button',{name:'Close menu'})).toHaveAttribute('aria-expanded','true');fireEvent.keyDown(document,{key:'Escape'});expect(screen.getByRole('button',{name:'Menu'})).toHaveFocus();expect(screen.getByRole('button',{name:'Menu'})).toHaveAttribute('aria-expanded','false');
});
it('renders the published insurance list and visit address on their actual routes',async()=>{
 fixture('Test Hospital',[],{insurance:[{name:'Published insurer'}],openingHours:'Published hours'});history.replaceState({},'','/insurance');render(<App/>);expect(await screen.findByText('Published insurer')).toBeInTheDocument();expect(screen.getByText(/This page does not confirm coverage/)).toBeInTheDocument();
});
it('requires runtime booking identity and reports unavailable saved branding',async()=>{
 delete runtime.HMS_WEBSITE;expect(()=>createPublicBookingApi()).toThrow(/not configured correctly/);vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:503})));render(<App/>);expect(await screen.findByRole('heading',{name:'The hospital website is temporarily unavailable.'})).toBeInTheDocument();
});
it('opens a published specialty with its own filtered care team',async()=>{
 fixture();history.replaceState({},'','/departments/Medicine');render(<App/>);expect(await screen.findByRole('heading',{name:'Medicine at Test Hospital'})).toBeInTheDocument();expect(screen.getByText('Dr One')).toBeInTheDocument();expect(screen.getByText('Dr Two')).toBeInTheDocument();
});
