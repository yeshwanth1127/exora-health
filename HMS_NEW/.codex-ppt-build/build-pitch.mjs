import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "/Users/ysw/EXORA/exora-health/HMS_NEW";
const buildDir = path.join(workspaceDir, ".codex-ppt-build");
const renderDir = path.join(buildDir, "renders");
const outputDir = path.join(workspaceDir, "deliverables");
const finalPath = path.join(outputDir, "Exora_Health_Hospital_Director_Pitch.pptx");
const skillDir = "/Users/ysw/.codex/plugins/cache/openai-primary-runtime/presentations/26.1015.12040/skills/presentations";
const runtimePython = "/Users/ysw/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

await fs.mkdir(renderDir, { recursive: true });
await fs.mkdir(outputDir, { recursive: true });

const ppt = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const W = 1280, H = 720;
const C = {
  ink: "#17312D", green: "#2F6B52", lime: "#DCEFC8", cream: "#F6F4EC",
  white: "#FFFFFF", muted: "#667B75", line: "#D9E2DC", dark: "#102923",
  aqua: "#D9F0EA", amber: "#F6E6B8", soft: "#EEF3EF", whatsapp: "#25D366",
};
const FONT = "Avenir Next";

function rect(slide, x, y, w, h, fill, radius = 0, line = "none") {
  return slide.shapes.add({ geometry: radius ? "roundRect" : "rect", position: { left:x, top:y, width:w, height:h }, fill, line: { style:"solid", fill:line, width: line === "none" ? 0 : 1 }, borderRadius: radius });
}
function txt(slide, text, x, y, w, h, size=24, color=C.ink, bold=false, align="left") {
  const s = slide.shapes.add({ geometry:"textbox", position:{left:x,top:y,width:w,height:h}, fill:"none", line:{style:"solid",fill:"none",width:0} });
  s.text = text;
  s.text.style = { fontFamily:FONT, fontSize:size, color, bold, alignment:align, verticalAlignment:"middle" };
  s.text.insets = 0;
  return s;
}
function label(slide, text, x, y, w=220, color=C.green) { return txt(slide, text.toUpperCase(), x,y,w,24,12,color,true); }
function title(slide, text, sub="") {
  txt(slide, text, 68, 50, 1080, 58, 32, C.ink, true);
  if (sub) txt(slide, sub, 70, 110, 1090, 42, 17, C.muted, false);
}
function footer(slide, n, dark=false) {
  txt(slide, "EXORA HEALTH", 70, 680, 180, 18, 10, dark?"#AEC2BA":C.muted, true);
  txt(slide, String(n).padStart(2,"0"), 1170, 680, 40, 18, 10, dark?"#AEC2BA":C.muted, true, "right");
}
function addNotes(slide, lines) { slide.speakerNotes.text = lines; slide.speakerNotes.setVisible(true); }
async function addImage(slide, file, pos, alt, fit="cover") {
  const b = await fs.readFile(file);
  const ab = b.buffer.slice(b.byteOffset, b.byteOffset+b.byteLength);
  return slide.images.add({ blob:ab, contentType:"image/png", alt, fit, position:pos, geometry:"roundRect", borderRadius:"rounded-xl" });
}
function dot(slide, x,y,color=C.green,r=14) { return slide.shapes.add({geometry:"ellipse",position:{left:x-r,top:y-r,width:r*2,height:r*2},fill:color,line:{style:"solid",fill:color,width:0}}); }
function line(slide,x,y,w,color=C.line,width=2) { return slide.shapes.add({geometry:"line",position:{left:x,top:y,width:w,height:0},fill:"none",line:{style:"solid",fill:color,width}}); }

// 1 — cover
{
  const s=ppt.slides.add(); s.background.fill=C.cream;
  rect(s, 0,0,420,H,C.dark); rect(s,420,0,860,H,C.cream);
  rect(s,70,65,54,54,C.lime,14); txt(s,"+",70,61,54,54,34,C.dark,true,"center");
  txt(s,"EXORA HEALTH",145,70,220,38,17,C.white,true);
  label(s,"Hospital growth proposal",485,90,300,C.green);
  txt(s,"Turn every patient enquiry\ninto a booked appointment",485,150,690,190,48,C.ink,true);
  txt(s,"AI voice receptionist, WhatsApp booking, web booking and one staff workspace",488,365,660,88,23,C.muted,false);
  rect(s,488,500,310,64,C.green,16); txt(s,"PHASE 1  •  PATIENT ACQUISITION",510,500,270,64,15,C.white,true,"center");
  txt(s,"Built to extend into a complete HMS",488,590,520,30,17,C.ink,true);
  txt(s,"Director presentation  |  19 October 2026",488,632,520,24,13,C.muted,false);
  addNotes(s,["Open with the business outcome: more enquiries converted into confirmed appointments.","Position the HMS as the expansion path after the patient acquisition layer is stable."]);
}

// 2 — problem
{
  const s=ppt.slides.add(); s.background.fill=C.white; title(s,"The patient journey breaks before care begins","Hospitals lose demand when phone, WhatsApp and website enquiries operate as separate queues.");
  const rows=[
    ["01","Calls arrive when reception is busy","Missed calls and repeated follow-ups"],
    ["02","WhatsApp conversations stay manual","Slow replies and inconsistent booking"],
    ["03","Website forms do not see live schedules","Staff must call patients again"],
    ["04","Channel activity is hard to measure","No shared view of demand and conversion"],
  ];
  rows.forEach((r,i)=>{ const y=185+i*105; txt(s,r[0],70,y,55,55,21,C.green,true); line(s,135,y+29,95,C.line,2); txt(s,r[1],255,y-4,400,42,22,C.ink,true); txt(s,r[2],720,y-4,440,52,18,C.muted,false); });
  rect(s,70,615,1110,2,C.green); txt(s,"The first goal is simple: answer faster, show real availability and confirm the booking in the same interaction.",70,628,1050,36,19,C.ink,true); footer(s,2);
  addNotes(s,["Avoid claiming a current loss percentage unless the hospital supplies data.","Ask where most enquiries currently arrive and when reception pressure peaks."]);
}

// 3 — phase 1 system
{
  const s=ppt.slides.add(); s.background.fill=C.cream; title(s,"Phase 1: one patient acquisition system","Four entry points connect to the same appointment workflow.");
  const centers=[155,425,695,965]; const names=["AI voice","WhatsApp","Hospital website","Staff desk"];
  const desc=["Answers enquiries and books","Guided automated booking","Live doctor and slot selection","Manual booking and oversight"];
  centers.forEach((x,i)=>{ dot(s,x+55,240,i===1?C.whatsapp:C.green,46); txt(s,String(i+1),x+31,216,48,48,24,C.white,true,"center"); txt(s,names[i],x,302,170,34,21,C.ink,true,"center"); txt(s,desc[i],x-20,342,210,58,15,C.muted,false,"center"); });
  line(s,210,440,810,C.green,4); centers.forEach(x=>line(s,x+55,286,0,C.green,2));
  rect(s,330,455,620,118,C.dark,22); txt(s,"Shared booking engine",370,474,540,34,28,C.white,true,"center"); txt(s,"Doctors  •  services  •  schedules  •  availability  •  confirmations",370,520,540,26,16,"#C7D8D1",false,"center");
  txt(s,"Every confirmed appointment appears in the hospital workspace.",330,594,620,30,18,C.green,true,"center"); footer(s,3);
  addNotes(s,["Stress that the channels do not maintain separate calendars.","A single booking engine reduces double handling and supports consistent reporting."]);
}

// 4 — patient journey
{
  const s=ppt.slides.add(); s.background.fill=C.white; title(s,"A shorter path from enquiry to appointment","The system keeps the patient in the same channel while the hospital retains control.");
  const steps=[
    ["1","Patient contacts the hospital","Voice, WhatsApp or web"],
    ["2","System understands the need","Speciality, doctor, visit mode"],
    ["3","Live slots are offered","Only current availability"],
    ["4","Patient confirms","Name, phone and consent"],
    ["5","Staff sees the booking","One queue and audit trail"],
  ];
  steps.forEach((a,i)=>{const x=55+i*245; dot(s,x+52,236,C.green,32); txt(s,a[0],x+32,216,40,40,19,C.white,true,"center"); if(i<4) line(s,x+84,236,129,C.line,4); txt(s,a[1],x,300,205,58,19,C.ink,true,"center"); txt(s,a[2],x,366,205,48,15,C.muted,false,"center");});
  rect(s,70,485,1110,120,C.soft,18); txt(s,"Built-in controls",100,505,190,30,18,C.green,true); txt(s,"Slot holds prevent duplicate booking. Tenant isolation separates hospital data. Staff can review channel history and intervene when needed.",300,493,835,75,19,C.ink,false);
  footer(s,4); addNotes(s,["Walk through one example: a caller asks for a cardiology appointment, hears available slots and confirms without waiting for reception.","Mention that staff remain able to review and correct exceptions."]);
}

// 5 — voice
{
  const s=ppt.slides.add(); s.background.fill=C.dark; txt(s,"AI voice receptionist",70,55,680,55,34,C.white,true); txt(s,"A dedicated hospital front desk that can answer, check availability and complete bookings.",70,115,760,52,18,"#C7D8D1");
  rect(s,70,205,510,370,"#173A32",22); dot(s,325,325,C.lime,80); txt(s,"VOICE",260,299,130,55,22,C.dark,true,"center");
  txt(s,"Dedicated number",110,440,190,34,18,C.white,true); txt(s,"Assigned to the hospital tenant",110,475,220,34,15,"#B9CEC5");
  txt(s,"Call history",345,440,170,34,18,C.white,true); txt(s,"Review outcomes and recordings where consent permits",345,475,190,60,15,"#B9CEC5");
  const ys=[215,300,385,470]; const heads=["Answers routine enquiries","Books against live schedules","Escalates exceptions to staff","Keeps every tenant isolated"]; const subs=["Doctors, services, locations and hours","Holds and confirms the selected slot","Reception handles sensitive or unclear cases","Separate credentials, database and audit boundary"];
  ys.forEach((y,i)=>{dot(s,690,y+18,C.lime,9); txt(s,heads[i],720,y,430,35,21,C.white,true); txt(s,subs[i],720,y+38,430,42,15,"#B9CEC5");});
  txt(s,"Activation requires the hospital’s approved phone and provider setup.",720,588,430,30,14,"#EBCF85",true); footer(s,5,true);
  addNotes(s,["Demo the assigned number and call history if available.","Do not promise medical advice. Keep the voice agent focused on front desk information and appointments."]);
}

// 6 — WhatsApp
{
  const s=ppt.slides.add(); s.background.fill=C.cream; title(s,"WhatsApp automated booking","A guided conversation can turn a message into a confirmed appointment, with staff handoff when needed.");
  rect(s,70,175,430,430,C.white,26,C.line);
  txt(s,"WhatsApp",105,200,190,32,21,C.ink,true); dot(s,445,216,C.whatsapp,11);
  const bubbles=[
    ["Patient","I need a skin specialist tomorrow",105,265,310,C.soft,C.ink],
    ["Exora","Dr Meera has 10:30 AM and 12:00 PM available.",150,345,310,C.aqua,C.ink],
    ["Patient","10:30 AM",105,438,180,C.soft,C.ink],
    ["Exora","Please confirm the patient name and booking consent.",150,500,310,C.aqua,C.ink],
  ];
  bubbles.forEach(b=>{txt(s,b[0],b[2],b[3]-20,120,18,11,C.muted,true); rect(s,b[2],b[3],b[4],54,b[5],14); txt(s,b[1],b[2]+14,b[3]+7,b[4]-28,40,14,b[6],false);});
  const items=[["Live availability","Uses the same doctor schedules as voice and web"],["Explicit confirmation","Collects the details required before booking"],["Human handoff","Stops automation when the patient asks for staff"],["Controlled launch","Meta account, number and templates require approval"]];
  items.forEach((a,i)=>{const y=190+i*105; txt(s,String(i+1),570,y,40,38,17,C.green,true); txt(s,a[0],630,y,470,30,21,C.ink,true); txt(s,a[1],630,y+38,500,42,16,C.muted,false);}); footer(s,6);
  addNotes(s,["Frame WhatsApp as a guided booking journey, not an open-ended medical chatbot.","Provider activation depends on the hospital’s Meta Business and phone-number readiness."]);
}

// 7 — workspace with screenshot
{
  const s=ppt.slides.add(); s.background.fill=C.white; title(s,"One workspace for reception and management","Bookings from every channel arrive in the same operational view.");
  await addImage(s,path.join(workspaceDir,"docs/plan/staff-integration-audit/integrated-staff-preview.png"),{left:70,top:175,width:720,height:405},"Exora Health staff workspace preview","contain");
  const points=[["Appointments","Book, reschedule, cancel and check in"],["Patients","Search and register patient details"],["Queues","Track walk-ins and consultation flow"],["Channel oversight","Review voice and WhatsApp activity"]];
  points.forEach((a,i)=>{const y=185+i*94; dot(s,855,y+17,C.green,8); txt(s,a[0],880,y,300,28,20,C.ink,true); txt(s,a[1],880,y+34,300,40,15,C.muted,false);});
  rect(s,850,575,330,58,C.lime,14); txt(s,"Designed for hospital roles and permissions",870,582,290,42,14,C.dark,true,"center"); footer(s,7);
  addNotes(s,["The dashboard becomes the hospital’s operational source of truth for appointments.","Role-based access limits what front desk, clinicians and administrators can see or change."]);
}

// 8 — roadmap
{
  const s=ppt.slides.add(); s.background.fill=C.cream; title(s,"Phase 2: expand into the complete HMS","The acquisition layer becomes the digital front door for a broader hospital operating system.");
  rect(s,70,180,500,390,C.dark,24); label(s,"Foundation available",105,210,240,C.lime); txt(s,"Patient + OPD core",105,255,390,45,29,C.white,true);
  const built=["Patient registration and records","Doctor schedules and appointments","Check-in, queue and encounters","Clinical notes and Virtual OPD"];
  built.forEach((x,i)=>{dot(s,118,335+i*48,C.lime,6); txt(s,x,140,319+i*48,370,34,17,C.white,false);});
  rect(s,620,180,560,390,C.white,24,C.line); label(s,"Planned expansion",655,210,240,C.green); txt(s,"Hospital-wide modules",655,255,440,45,29,C.ink,true);
  const future=["Diagnostics and imaging","Pharmacy and inventory","Billing, payments and insurance","Inpatient, beds and theatre operations"];
  future.forEach((x,i)=>{txt(s,String(i+1),655,327+i*49,35,32,15,C.green,true); txt(s,x,700,319+i*49,420,34,17,C.ink,false);});
  txt(s,"Scope, workflow and rollout sequence will be agreed with hospital leadership before Phase 2.",70,620,1080,34,17,C.green,true,"center"); footer(s,8);
  addNotes(s,["Separate what exists now from what follows later.","Use Phase 1 operating data and staff feedback to prioritise the HMS rollout."]);
}

// 9 — rollout
{
  const s=ppt.slides.add(); s.background.fill=C.white; title(s,"A controlled rollout around one pilot facility","Each stage has a clear operational owner and acceptance check.");
  const stages=[
    ["01","Discover","Confirm departments, doctors, schedules, FAQs and escalation rules"],
    ["02","Configure","Brand the website, connect channels and train the receptionist agent"],
    ["03","Pilot","Launch with selected departments, monitor bookings and support staff"],
    ["04","Expand","Add departments and channels, then begin the agreed HMS roadmap"],
  ];
  stages.forEach((a,i)=>{const x=70+i*285; rect(s,x,190,245,330,i===2?C.dark:C.soft,22); txt(s,a[0],x+25,215,55,34,16,i===2?C.lime:C.green,true); txt(s,a[1],x+25,278,195,40,25,i===2?C.white:C.ink,true); txt(s,a[2],x+25,340,195,115,16,i===2?"#C7D8D1":C.muted,false);});
  txt(s,"Pilot success measures",70,575,250,30,18,C.green,true); txt(s,"Enquiries answered  •  confirmed bookings  •  time to confirmation  •  staff interventions  •  patient drop-off",330,568,850,44,18,C.ink,true); footer(s,9);
  addNotes(s,["Do not commit dates before confirming integrations, data readiness and approval owners.","Recommend one facility or department first so both teams can validate the patient journey quickly."]);
}

// 10 — close
{
  const s=ppt.slides.add(); s.background.fill=C.dark;
  label(s,"Recommended next step",70,75,260,C.lime);
  txt(s,"Approve a focused patient acquisition pilot",70,130,840,72,42,C.white,true);
  txt(s,"Launch the channels that matter most, measure conversion, and use the same platform as the foundation for HMS expansion.",70,220,840,88,22,"#C7D8D1");
  rect(s,70,385,340,120,"#173A32",20); txt(s,"1 pilot facility",95,406,290,38,25,C.white,true); txt(s,"Selected departments and doctors",95,452,290,28,15,"#B9CEC5");
  rect(s,435,385,340,120,"#173A32",20); txt(s,"4 connected entry points",460,406,290,38,25,C.white,true); txt(s,"Voice, WhatsApp, web and staff desk",460,452,290,28,15,"#B9CEC5");
  rect(s,800,385,340,120,C.lime,20); txt(s,"One booking source",825,406,290,38,25,C.dark,true); txt(s,"Clear ownership and measurable outcomes",825,452,290,40,15,C.dark);
  txt(s,"Decision for tomorrow: nominate the pilot facility, operational owner and preferred first channel.",70,585,1070,44,19,C.lime,true); footer(s,10,true);
  addNotes(s,["Close by asking for a pilot sponsor and a working session with reception and IT.","Offer a short demonstration of voice, web booking and the staff workspace after the discussion."]);
}

for (const [i, slide] of ppt.slides.items.entries()) {
  const png = await ppt.export({ slide, format:"png", scale:1 });
  await fs.writeFile(path.join(renderDir,`slide-${String(i+1).padStart(2,"0")}.png`),new Uint8Array(await png.arrayBuffer()));
}
const montage = await ppt.export({ format:"webp", montage:true });
await fs.writeFile(path.join(buildDir,"montage.webp"),new Uint8Array(await montage.arrayBuffer()));

const candidatePath=path.join(buildDir,"candidate.pptx");
await (await PresentationFile.exportPptx(ppt)).save(candidatePath);
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir,"container_tools/artifact_tool_utils.mjs")).href);
await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  explicitTotalSlideCount:10,
  requiredNativeTableOwnerSlides:[],
  requiredNativeChartOwnerSlides:[],
  fontPolicy:{basis:"design",families:["Aptos"]},
  pythonExecutable:runtimePython,
  integrityValidatorPath:path.join(skillDir,"container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath:path.join(skillDir,"container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs:["--expected-slide-size-emu","12192000,6858000","--validate-heading-fit"],
  verifyArtifactToolImport:true,
  receiptPath:path.join(buildDir,"validation.json"),
});
console.log(finalPath);
