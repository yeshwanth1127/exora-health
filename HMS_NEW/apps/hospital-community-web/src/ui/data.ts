export const hospital={name:'Swastikaa Hospital',area:'Kaggadasapura, Bengaluru'};
export const specialties=[
 {id:'general-medicine',name:'General medicine',short:'Everyday health, ongoing care',description:'A starting point for general health concerns, routine consultations and ongoing conditions.',prepare:'Bring previous reports and a list of current medicines.'},
 {id:'orthopaedics',name:'Orthopaedics',short:'Bones, joints and movement',description:'Meet a specialist to discuss joint pain, injuries, mobility and treatment options.',prepare:'Bring relevant X-rays, scan reports and previous prescriptions.'},
 {id:'gynaecology',name:'Gynaecology',short:'Women’s health',description:'Consultations for reproductive health, menstrual concerns and care through different stages of life.',prepare:'Bring relevant reports and details of current medicines.'},
 {id:'paediatrics',name:'Paediatrics',short:'Care for children',description:'Consultations for childhood health concerns, development and routine follow-up.',prepare:'Bring the child’s vaccination record and previous reports.'},
 {id:'cardiology',name:'Cardiology',short:'Heart health',description:'Discuss heart health, assessment and follow-up with a specialist.',prepare:'Bring existing ECGs, scan results and a current medication list.'},
 {id:'general-surgery',name:'General surgery',short:'Assessment and surgical advice',description:'Understand a condition, discuss treatment options and plan the next step with a surgeon.',prepare:'Bring previous consultation notes, scan results and referral documents.'}
];
export const doctors=[
 {id:'ananya-rao',name:'Dr Ananya Rao',initials:'AR',specialty:'general-medicine',qualifications:'MBBS, MD · General medicine',experience:'12 years',languages:'English, Kannada, Hindi',days:'Mon – Sat',bio:'This example profile demonstrates how qualifications, clinical interests and consultation information will appear. It does not describe an actual Swastikaa clinician.'},
 {id:'karthik-shah',name:'Dr Karthik Shah',initials:'KS',specialty:'orthopaedics',qualifications:'MBBS, MS · Orthopaedics',experience:'14 years',languages:'English, Kannada, Hindi',days:'Mon, Wed, Fri',bio:'An illustrative orthopaedic profile for testing the doctor directory, profile page and appointment selection.'},
 {id:'meera-iyer',name:'Dr Meera Iyer',initials:'MI',specialty:'gynaecology',qualifications:'MBBS, MS · Obstetrics & gynaecology',experience:'11 years',languages:'English, Kannada, Tamil',days:'Mon – Fri',bio:'An illustrative profile for reviewing the consultation journey. All clinical credentials and availability shown here are sample content.'},
 {id:'rahul-menon',name:'Dr Rahul Menon',initials:'RM',specialty:'paediatrics',qualifications:'MBBS, MD · Paediatrics',experience:'9 years',languages:'English, Kannada, Malayalam',days:'Mon – Sat',bio:'This example profile supports browsing, filtering and booking-flow testing. The hospital’s actual care team will replace this content.'},
 {id:'neha-patel',name:'Dr Neha Patel',initials:'NP',specialty:'cardiology',qualifications:'MBBS, MD, DM · Cardiology',experience:'13 years',languages:'English, Hindi, Kannada',days:'Tue, Thu, Sat',bio:'An example cardiology profile showing how a patient can review a specialist and choose a consultation.'},
 {id:'arjun-kumar',name:'Dr Arjun Kumar',initials:'AK',specialty:'general-surgery',qualifications:'MBBS, MS · General surgery',experience:'10 years',languages:'English, Kannada, Telugu',days:'Mon – Fri',bio:'An illustrative surgical consultation profile. This screen is a UI demonstration and is not a published clinical roster.'}
];
export const plans=[
 {id:'essential',name:'Essential health check',price:1499,summary:'A straightforward starting point for a health review.',tests:['Complete blood count','Blood glucose','Lipid profile','Urine routine','Physician consultation'],preparation:'Preparation depends on the selected tests. Confirm fasting instructions with the hospital.'},
 {id:'comprehensive',name:'Comprehensive health check',price:3499,summary:'A broader set of checks to discuss with your physician.',tests:['All essential checks','Liver function','Kidney function','Thyroid profile','ECG','Physician review'],preparation:'Bring previous reports and a current medicine list. Confirm fasting instructions before attending.'},
 {id:'women',name:'Women’s health check',price:2999,summary:'A sample health check with a consultation for women.',tests:['Complete blood count','Blood glucose','Thyroid profile','Urine routine','Gynaecology consultation'],preparation:'Discuss the appropriate tests and any preparation with the care team.'}
];
export const insurers=['Star Health','HDFC ERGO','Niva Bupa','ICICI Lombard','Care Health','Bajaj Allianz','Aditya Birla Health','SBI General'];
export const faqs=[
 {q:'How do I book an appointment?',a:'Choose a consultant and see their example schedule. Select an available slot to preview the appointment assistant handoff. There is no appointment form, and this UI does not reserve an appointment.'},
 {q:'Can I use my health insurance?',a:'The insurer directory on this preview is illustrative. For actual care, confirm hospital acceptance, policy eligibility and pre-authorisation requirements directly with reception.'},
 {q:'What should I bring?',a:'Bring relevant medical reports, a current medication list, referral documents and any insurance information. Confirm specific preparation with your clinician.'},
 {q:'Can I change my appointment?',a:'Use Change selection to choose another example slot. The appointment assistant will manage the live journey when connected; this UI does not create or change a real appointment.'},
 {q:'Where is the hospital?',a:'The locality supplied for this project is Kaggadasapura, Bengaluru. The exact street address, contact numbers and visiting hours are awaiting verification.'},
 {q:'Are the prices and doctors here real?',a:'No. Clinicians, qualifications, schedules, plan prices and insurers are example content for reviewing the website UI.'}
];
export const specialtyName=(id:string)=>specialties.find(s=>s.id===id)?.name||id;
