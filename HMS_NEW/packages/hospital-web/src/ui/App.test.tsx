import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import App from './App';
vi.mock('../components/sections/HospitalGallerySection',()=>({HospitalGallerySection:()=> <section aria-label="Photo gallery">Illustrative gallery</section>}));
const fetchSpy=vi.fn();
Element.prototype.scrollIntoView=vi.fn();
beforeEach(()=>{history.replaceState({},'','/');vi.stubGlobal('scrollTo',vi.fn());vi.stubGlobal('fetch',fetchSpy);fetchSpy.mockClear();});
afterEach(()=>vi.unstubAllGlobals());
it('uses the supplied wordmark and working menus without news or charity',()=>{
 render(<App/>);expect(screen.getAllByRole('img',{name:'Swastikaa Hospital'})[0]).toHaveAttribute('src','/brand/swastikaa-hospital.png');expect(screen.queryByRole('link',{name:/charity|news/i})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Patient information'}));expect(screen.getByRole('link',{name:'Your appointment journey'})).toBeInTheDocument();fireEvent.keyDown(document,{key:'Escape'});expect(screen.getByRole('button',{name:'Patient information'})).toHaveAttribute('aria-expanded','false');expect(screen.getByRole('button',{name:'Patient information'})).toHaveFocus();fireEvent.click(screen.getByRole('button',{name:'Treatments & services'}));expect(screen.getByRole('link',{name:'A–Z of all tests & scans »'})).toBeInTheDocument();fireEvent.click(screen.getByRole('link',{name:'Orthopaedics',exact:true}));expect(screen.getByRole('heading',{level:1,name:'Orthopaedics clinic'})).toBeInTheDocument();expect(fetchSpy).not.toHaveBeenCalled();
});
it('runs treatment autocomplete with keyboard selection and shows related consultants',()=>{
 history.replaceState({},'','/consultants');render(<App/>);const care=screen.getByRole('combobox',{name:'Search by treatment or specialty'});fireEvent.change(care,{target:{value:'hip'}});expect(screen.getByRole('option',{name:'Hip replacement surgery'})).toBeInTheDocument();fireEvent.keyDown(care,{key:'ArrowDown'});fireEvent.keyDown(care,{key:'Enter'});expect(care).toHaveValue('Hip replacement surgery');fireEvent.click(screen.getByRole('button',{name:'Search Consultants'}));expect(screen.getByText(/1 consultant found/)).toBeInTheDocument();fireEvent.click(screen.getByRole('link',{name:'View Dr Karthik Shah'}));expect(screen.getByRole('heading',{level:1,name:'Dr Karthik Shah'})).toBeInTheDocument();expect(screen.getByRole('heading',{name:'Consultant schedules & available slots'})).toBeInTheDocument();expect(document.querySelector('main form')).toBeNull();
});
it('handles unmatched consultant search and restores the specialty shortcuts',()=>{
 history.replaceState({},'','/consultants');render(<App/>);fireEvent.change(screen.getByRole('textbox',{name:'Name',exact:true}),{target:{value:'no-match'}});fireEvent.click(screen.getByRole('button',{name:'Search Consultants'}));expect(screen.getByRole('heading',{name:'No consultants match your search'})).toBeInTheDocument();fireEvent.click(screen.getAllByRole('link',{name:'Clear search'})[0]);expect(screen.getByRole('link',{name:'Paediatrics',exact:true})).toBeInTheDocument();
});
it('filters consultants by patient age and preserves the search in the URL',()=>{
 history.replaceState({},'','/consultants');render(<App/>);fireEvent.change(screen.getByRole('combobox',{name:'Consultant treats'}),{target:{value:'paediatric'}});fireEvent.click(screen.getByRole('button',{name:'Search Consultants'}));expect(screen.getByText(/1 consultant found/)).toBeInTheDocument();expect(screen.getByRole('link',{name:'View Dr Rahul Menon'})).toBeInTheDocument();expect(location.search).toContain('sees=paediatric');
});
it('carries header search into the consultant finder',()=>{
 render(<App/>);fireEvent.change(screen.getByRole('textbox',{name:'Search doctors or specialties'}),{target:{value:'Ananya'}});fireEvent.click(screen.getByRole('button',{name:'Search doctors'}));expect(screen.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('Ananya');expect(screen.getByText(/1 consultant found/)).toBeInTheDocument();
});
it('selects an example slot without any appointment or patient-details form',()=>{
 history.replaceState({},'','/book?doctor=ananya-rao');render(<App/>);expect(document.querySelector('main form')).toBeNull();expect(screen.queryByRole('textbox',{name:'Patient name'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Continue with this slot'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:/^Choose Monday/}));expect(screen.getByRole('button',{name:/10:30 AM/})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'09:00 AM'}));fireEvent.click(screen.getByRole('button',{name:'Continue with this slot'}));expect(screen.getByRole('heading',{name:'Slot selected'})).toBeInTheDocument();expect(screen.getByText(/No appointment is reserved or confirmed/)).toBeInTheDocument();expect(fetchSpy).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(0);expect(localStorage.length).toBe(0);fireEvent.click(screen.getByRole('button',{name:'Change selection'}));expect(screen.getByRole('button',{name:'09:00 AM'})).toHaveAttribute('aria-pressed','true');
});
it('shows the unavailable schedule state and resets selections when changing week',()=>{
 history.replaceState({},'','/book?doctor=ananya-rao');render(<App/>);fireEvent.click(screen.getByRole('button',{name:/^Choose Sunday/}));expect(screen.getByRole('heading',{name:'No slots in this example schedule'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Continue with this slot'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:/^Choose Monday/}));fireEvent.click(screen.getByRole('button',{name:'09:00 AM'}));fireEvent.click(screen.getByRole('button',{name:'Next week'}));expect(screen.getByRole('button',{name:'Continue with this slot'})).toBeDisabled();expect(screen.queryByRole('button',{name:'09:00 AM'})).not.toBeInTheDocument();
});
it.each([
 ['/clinics/general-medicine','General medicine clinic'],['/clinics/orthopaedic','Orthopaedics clinic'],['/clinics/gynaecology','Gynaecology clinic'],['/clinics/paediatrics','Paediatrics clinic'],['/clinics/cardiology','Cardiology clinic'],['/clinics/general-surgery','General surgery clinic'],
 ['/treatments/hip-replacement-surgery','Hip replacement surgery'],['/treatments/knee-replacement-surgery','Knee replacement surgery'],['/treatments/hernia-repair','Hernia repair'],['/treatments/laparoscopic-surgery','Laparoscopic surgery'],['/treatments/cardiology-consultation','Cardiology consultation'],['/treatments/women-health-consultation','Women’s health consultation'],
 ['/tests-scans/mri','MRI scan'],['/tests-scans/ct-scans','CT scan'],['/tests-scans/ultrasound','Ultrasound'],['/tests-scans/x-ray','X-ray'],['/tests-scans/mammogram','Mammogram'],['/tests-scans/ecg','ECG'],
])('renders care detail %s with a schedule and no appointment form',(path,title)=>{
 history.replaceState({},'',path);render(<App/>);expect(screen.getByRole('heading',{level:1,name:title})).toBeInTheDocument();expect(document.getElementById('schedule')).toBeInTheDocument();expect(document.querySelector('main form')).toBeNull();expect(fetchSpy).not.toHaveBeenCalled();
});
it('links scan pricing and appointment actions to the correct inline sections',()=>{
 history.replaceState({},'','/tests-scans/mri');render(<App/>);expect(screen.getByRole('link',{name:'See pricing details'})).toHaveAttribute('href','#pricing');expect(screen.getByRole('link',{name:'View scan slots'})).toHaveAttribute('href','#schedule');expect(screen.getByRole('heading',{name:'Scan appointments'})).toBeInTheDocument();expect(screen.getByRole('heading',{name:'MRI scan',level:3})).toBeInTheDocument();const question=screen.getByRole('button',{name:'Do I need a referral?'});fireEvent.click(question);expect(question).toHaveAttribute('aria-expanded','true');expect(screen.getByText(/The team will confirm referral requirements/)).toBeVisible();
});
it('preserves a selected health plan through its local general enquiry state',()=>{
 history.replaceState({},'','/plans/comprehensive');render(<App/>);fireEvent.click(screen.getByRole('link',{name:'Enquire about this plan'}));expect(screen.getByText(/Plan selected:/)).toBeInTheDocument();fireEvent.change(screen.getByRole('textbox',{name:'Your name'}),{target:{value:'Example Person'}});fireEvent.change(screen.getByRole('textbox',{name:'Email address'}),{target:{value:'example@example.com'}});fireEvent.change(screen.getByRole('textbox',{name:'Your message'}),{target:{value:'Sample enquiry'}});fireEvent.click(screen.getByRole('button',{name:'Preview enquiry'}));expect(screen.getByRole('heading',{name:'Enquiry preview complete'})).toBeInTheDocument();expect(fetchSpy).not.toHaveBeenCalled();
});
it('routes the Sri Lakshmi bento and insurer logo to their correct destinations',()=>{
 render(<App/>);fireEvent.click(screen.getByRole('button',{name:/Orthopaedics.*Explore care/}));expect(screen.getByRole('heading',{level:1,name:'Orthopaedics clinic'})).toBeInTheDocument();fireEvent.click(screen.getByRole('link',{name:'Swastikaa Hospital home'}));fireEvent.click(screen.getByRole('button',{name:'Ask about HDFC ERGO'}));expect(screen.getByText('Example insurer selected: HDFC ERGO')).toBeInTheDocument();expect(fetchSpy).not.toHaveBeenCalled();
});
it('keeps the Arc FAQ disclosure working',async()=>{
 history.replaceState({},'','/faq');render(<App/>);const trigger=screen.getByRole('button',{name:'How do I book an appointment?'});fireEvent.click(trigger);expect(trigger).toHaveAttribute('aria-expanded','true');await waitFor(()=>expect(screen.getByText(/Choose a consultant and see their example schedule/)).toBeVisible());fireEvent.click(trigger);expect(trigger).toHaveAttribute('aria-expanded','false');
});
it('recovers from a missing care page',()=>{
 history.replaceState({},'','/tests-scans/missing');render(<App/>);expect(screen.getByRole('heading',{name:'Let’s help you find your way.'})).toBeInTheDocument();fireEvent.click(screen.getByRole('link',{name:'Return home'}));expect(screen.getByRole('heading',{level:1,name:/Care for you/})).toBeInTheDocument();
});
