import { BRAND_NAME } from "./brand.ts";
export type AudienceKey = "teams" | "enterprise" | "labs" | "dental" | "physiotherapy";
export type AudienceContent = {
 eyebrow:string; hero:string; intro:string; heroArt:string; heroAlt:string; artworkPrefix?:string;
 rows:{title:string;body:string;alt:string}[]; starterIntro:string; starters:{title:string;body:string}[];
 rolloutTitle:string; rollout:{title:string;description:string;title2:string;description2:string;title3:string;description3:string};
 cta:string; faqs?:{q:string;a:string}[]; workflow?:{title:string;body:string}[];
};
export const audiencePages: Record<AudienceKey, AudienceContent> = {
 teams: {
  eyebrow: (BRAND_NAME + " for clinics"),
  hero: "A calmer clinic day starts here.",
  intro: "Answer patient enquiries, keep appointments moving and stay in touch after every visit. Give your small team one place to manage the day.",
  heroArt: "/assets/capture-illustrations/welcome-clinic.webp", heroAlt: "A welcoming local clinic",
  rows: [
   {title:"A front desk that can keep up.",body:"Let AI reception handle routine questions and capture booking requests, while your team takes care of the conversations that need a person. Keep each enquiry connected to its next step.",alt:"Appointments workspace with illustrative data"},
   {title:"Keep the clinic day in one view.",body:"Bring appointments, arrivals and patient handoffs into a shared workspace. Reception and doctors can see what comes next without checking separate lists or asking for another update.",alt:"Shared care team workspace with illustrative data"},
   {title:"Keep the conversation going.",body:"Reach patients on WhatsApp with timely follow-ups, keep your Google Business Profile up to date and see which enquiries become bookings. Make it easier for patients to find you and return.",alt:"Care inbox workspace with illustrative data"}
  ],
  starterIntro:"You do not have to change everything at once. Focus on the part of your clinic day that needs the most support.",
  starters:[{title:"Reception & arrivals",body:"Start with calls, appointment requests and a clear queue for your front desk."},{title:"Follow-ups & patient outreach",body:"Keep patient conversations organised and make the next visit easier to arrange."}],
  rolloutTitle:"A practical start for your practice.",
  rollout:{title:"Map your clinic day",description:"Walk through your calls, bookings and patient handoffs.",title2:"Bring your team together",description2:"Plan doctor schedules, staff access and front-desk responsibilities.",title3:"Start with a focused workflow",description3:"Choose where to begin, then review what your team wants to add next."},
  faqs:[{q:"Can we start with one workflow?",a:"Yes. Use the first phase to agree on a focused reception, appointment or patient communication workflow. Connected services depend on the configuration enabled for your practice."},{q:"How does teleconsultation fit the clinic day?",a:"Remote appointments can be coordinated alongside in-person visits. Live video depends on a supported, configured consultation service; confirm readiness before scheduling a remote session."}],
  cta:("See how " + BRAND_NAME + " fits your patients, your team and your everyday workflow.")
 },
 enterprise: {
  eyebrow: (BRAND_NAME + " for hospitals"),
  hero: "Connected care, across every team.",
  intro: "Bring reception, patient engagement and clinic activity into a shared workspace. Help growing healthcare teams work together without adding more disconnected tools.",
  heroArt:"/assets/capture-illustrations/connected-clinics.webp",heroAlt:"Care teams working across connected clinics",
  rows:[
   {title:"A consistent first point of contact.",body:"Give patients a clear path from an incoming call to a booking request. Use AI reception for routine enquiries and keep handoffs visible to the front-desk team that needs to respond.",alt:"Appointments workspace with illustrative data"},
   {title:"Keep care teams on the same page.",body:"Connect appointments, arrivals and patient handoffs in one working view. Give reception, doctors and clinic managers the context they need to coordinate the day and spot where attention is needed.",alt:"Shared care team workspace with illustrative data"},
   {title:"Build lasting patient relationships.",body:"Bring WhatsApp outreach, Google Business management and booking analytics into the same conversation. Help your teams follow up consistently and understand how patients discover and return to your clinics.",alt:"Care inbox workspace with illustrative data"}
  ],
  starterIntro:"Build around the needs of your care teams. Choose a focused starting point before broadening the rollout.",
  starters:[{title:"Clinic operations",body:"Align reception, appointment queues and team handoffs around the way each clinic works."},{title:"Patient engagement",body:"Connect outreach, local visibility and enquiry tracking with the teams responsible for growth."}],
  rolloutTitle:"Plan a rollout around your organisation.",
  rollout:{title:"Map teams and workflows",description:"Review your clinic structure, responsibilities and patient journey.",title2:"Review access and setup",description2:"Discuss staff roles, operating requirements and the systems you already use.",title3:"Agree on a focused first phase",description3:"Choose the first clinic or workflow and define what to review before expanding."},
  faqs:[{q:"Can we begin with one department or location?",a:"Plan a focused first phase around one team, workflow or facility. Review responsibilities, access and connected-service readiness before broadening the rollout."},{q:"Does this replace every existing hospital system?",a:"No. These pages showcase reception, appointments and patient communication workflows. Review existing clinical, laboratory, imaging and other systems separately during implementation planning."}],
  cta:"Walk through your organisation’s patient journey and discuss a focused first phase."
 },
"labs": {
  "eyebrow": "Labs & diagnostic centres",
  "hero": "A clearer journey. Before every test.",
  "intro": "Bring enquiries, test appointments and patient communication into one working day. Help your front desk keep every visit organised, from the first question to the next step.",
  "heroArt": "",
  "heroAlt": "Labs and diagnostic centre workflow",
  "artworkPrefix": "labs",
  "rows": [
    {
      "title": "The right information, before they arrive.",
      "body": "Keep questions about services, opening hours and appointments with the team that can answer them. Use reception workflows for routine enquiries and give staff a clear place to review booking requests. Preparation advice comes from the instructions your centre approves.",
      "alt": "Enquiries and preparation instructions"
    },
    {
      "title": "Keep appointments and arrivals connected.",
      "body": "Coordinate test appointments and arrivals in a shared view. Give reception a clear picture of who is expected, who has arrived and which handoff needs attention, without losing the patient’s next step between separate lists.",
      "alt": "Diagnostic centre appointments and arrivals"
    },
    {
      "title": "Make the next step easier to follow.",
      "body": "Organise appointment reminders and administrative follow-ups through your connected messaging channels. Route questions about reports to your team and the reporting system you already use. Keep communication separate from interpreting a clinical result.",
      "alt": "Patient reminders and report enquiries"
    }
  ],
  "starterIntro": "Start with the front-desk workflow your centre needs most, then connect the rest of the patient journey.",
  "starters": [
    {
      "title": "Enquiries & test appointments",
      "body": "Organise questions, appointment requests and the information patients need before visiting."
    },
    {
      "title": "Reminders & patient replies",
      "body": "Keep preparation messages, visit reminders and incoming questions with the team that owns them."
    }
  ],
  "rolloutTitle": "A practical start for your centre.",
  "rollout": {
    "title": "Map the visit journey",
    "description": "Review enquiries, appointments, arrivals and patient follow-ups.",
    "title2": "Agree on the handoffs",
    "description2": "Define who owns each question, preparation instruction and report enquiry.",
    "title3": "Connect a focused workflow",
    "description3": "Start with reception or appointments and review the setup before expanding."
  },
  "cta": "Explore a connected front desk for your lab or diagnostic centre.",
  "faqs": [
    {
      "q": "Does this replace our laboratory or imaging system?",
      "a": "No. This showcase covers reception, appointments and patient communication. Sample processing, imaging, report authoring and clinical interpretation remain in your existing laboratory or imaging systems."
    },
    {
      "q": "How are preparation instructions handled?",
      "a": "Your centre supplies and approves the instructions for each service. Staff remain responsible for individual questions and instructions that require clinical review."
    }
  ],
  "workflow": [
    {
      "title": "Enquiry",
      "body": "Answer the patient’s routine questions and review the requested service."
    },
    {
      "title": "Appointment",
      "body": "Agree on an appointment and the centre-approved preparation information."
    },
    {
      "title": "Visit & follow-up",
      "body": "Keep arrivals and administrative replies connected to the front desk."
    }
  ]
},
"dental": {
  "eyebrow": "For dental practices",
  "hero": "From the first call to the next recall.",
  "intro": "Keep new enquiries, treatment appointments and patient follow-ups connected. Give your reception team a clearer view of the day, while your clinicians focus on care.",
  "heroArt": "",
  "heroAlt": "Dental practice workflow",
  "artworkPrefix": "dental",
  "rows": [
    {
      "title": "Make the first enquiry count.",
      "body": "Organise new-patient calls, routine questions and consultation requests. Keep the reason for the enquiry visible so your reception team can arrange the next step with the right clinician.",
      "alt": "Dental enquiry and consultation workflow"
    },
    {
      "title": "Keep the next appointment in view.",
      "body": "Coordinate consultation and treatment appointments around your clinicians’ availability. Keep arrivals, cancellations and rescheduling requests in the same working view, so reception can respond without checking separate lists.",
      "alt": "Dental appointments and patient arrivals"
    },
    {
      "title": "Stay connected between visits.",
      "body": "Use your connected messaging workflow for appointment reminders, administrative follow-ups and recall conversations. Keep replies with reception and leave treatment advice and clinical decisions with the dental team.",
      "alt": "Dental reminders and recall conversations"
    }
  ],
  "starterIntro": "Bring the everyday reception workflow together without asking your team to change every clinical tool at once.",
  "starters": [
    {
      "title": "New-patient enquiries",
      "body": "Keep the first call, consultation request and next appointment connected."
    },
    {
      "title": "Appointment follow-through",
      "body": "Organise reminders, rescheduling requests and recall conversations."
    }
  ],
  "rolloutTitle": "Built around your practice day.",
  "rollout": {
    "title": "Map the appointment journey",
    "description": "Review how enquiries move into consultations and treatment visits.",
    "title2": "Bring reception into the picture",
    "description2": "Agree on clinician schedules, arrival states and responsibilities.",
    "title3": "Start with the next visit",
    "description3": "Connect reminders and replies around one focused appointment workflow."
  },
  "cta": "See how reception, appointments and follow-ups fit your dental practice.",
  "faqs": [
    {
      "q": "Does this include dental charting or treatment planning?",
      "a": "This page focuses on reception, appointment coordination and patient communication. It does not represent dental charting, imaging or clinical treatment-planning capabilities."
    },
    {
      "q": "Can the team manage recall conversations?",
      "a": "Reception can organise follow-up and recall conversations through the messaging services configured for the practice. Clinical recall timing is decided by your dental team."
    }
  ],
  "workflow": [
    {
      "title": "Consultation request",
      "body": "Give the first enquiry an owner and a clear next step."
    },
    {
      "title": "Treatment visits",
      "body": "Keep the next scheduled appointment visible to reception."
    },
    {
      "title": "Recall conversation",
      "body": "Follow up on the timing agreed by the dental team."
    }
  ]
},
"physiotherapy": {
  "eyebrow": "For physiotherapy practices",
  "hero": "Keep every session connected.",
  "intro": "Bring assessment bookings, ongoing appointments and patient follow-ups into one shared workflow. Keep reception organised across a series of visits, not just the first one.",
  "heroArt": "",
  "heroAlt": "Physiotherapy practice workflow",
  "artworkPrefix": "physiotherapy",
  "rows": [
    {
      "title": "A clear start for every new enquiry.",
      "body": "Keep enquiries and initial assessment requests together. Give reception the context to review clinician availability and help the patient arrange a first visit. Clinical suitability and assessment stay with your physiotherapy team.",
      "alt": "Physiotherapy enquiry and assessment booking"
    },
    {
      "title": "Make the next session easy to coordinate.",
      "body": "Keep scheduled sessions, attendance and rescheduling requests visible to reception. Organise the administrative side of ongoing visits around the frequency agreed by the clinician, with a clear next appointment for the patient.",
      "alt": "Physiotherapy sessions and attendance"
    },
    {
      "title": "Follow through between appointments.",
      "body": "Use connected messaging for session reminders and administrative follow-ups. Keep patient replies visible to the team, with a handoff when a question needs a clinician rather than a scheduling answer.",
      "alt": "Physiotherapy session reminders and replies"
    }
  ],
  "starterIntro": "Start with booking and attendance, then bring reminders and patient replies into the same routine.",
  "starters": [
    {
      "title": "Assessment & ongoing visits",
      "body": "Keep initial assessment requests and subsequent appointments together."
    },
    {
      "title": "Attendance & follow-ups",
      "body": "Give reception a clear place to review missed visits and patient replies."
    }
  ],
  "rolloutTitle": "A practical start for your team.",
  "rollout": {
    "title": "Map your session workflow",
    "description": "Review how patients book an assessment and arrange ongoing visits.",
    "title2": "Agree on the handoffs",
    "description2": "Separate scheduling questions from those that need a clinician.",
    "title3": "Connect the next appointment",
    "description3": "Start with bookings, reminders and the replies your team needs to follow up."
  },
  "cta": "Explore a connected appointment workflow for your physiotherapy practice.",
  "faqs": [
    {
      "q": "Does this prescribe exercises or decide treatment frequency?",
      "a": "No. Your clinician determines the care plan, exercises and session frequency. This showcase covers the administrative workflow around those appointments."
    },
    {
      "q": "How does it support a series of appointments?",
      "a": "Reception can coordinate scheduled visits, attendance and patient replies in one workflow. Recurring-booking automation and other connected operations depend on the features enabled for your practice."
    }
  ],
  "workflow": [
    {
      "title": "Assessment booking",
      "body": "Organise the first appointment request and clinician availability."
    },
    {
      "title": "Ongoing sessions",
      "body": "Coordinate the visits agreed with the clinician."
    },
    {
      "title": "Follow-through",
      "body": "Keep attendance, reminders and replies in view."
    }
  ]
}
};
