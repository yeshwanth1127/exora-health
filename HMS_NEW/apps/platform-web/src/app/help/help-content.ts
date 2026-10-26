import { BRAND_NAME } from "../../lib/brand";
export const topics=[
 {id:'getting-started',title:'Getting started',description:("Your first steps with " + BRAND_NAME + "."),art:'/assets/capture-illustrations/welcome-clinic.webp'},
 {id:'ai-reception',title:'AI reception',description:'Calls, enquiries and team handoffs.',art:'/assets/capture-product-art/ai-reception.webp'},
 {id:'appointments',title:'Appointments & queue',description:'Bookings, schedules and arrivals.',art:'/assets/capture-home-product/product-next-step.webp'},
 {id:'whatsapp',title:'WhatsApp outreach',description:'Patient conversations and follow-ups.',art:'/assets/capture-product-art/whatsapp-outreach.webp'},
 {id:'growth',title:'Google & analytics',description:'Local visibility and clinic activity.',art:'/assets/capture-product-art/clinic-analytics.webp'},
 {id:'team',title:'Team & settings',description:'Doctors, services and workspace access.',art:'/assets/capture-illustrations/clinic-team-lime.webp'}
];
export const faqs=[
 {id:'start',topic:'getting-started',question:("How do I get started with " + BRAND_NAME + "?"),answer:'Start with a demo of your clinic’s patient journey. Review your doctors, services and front-desk workflow, then choose the first area to set up with your team.'},
 {id:'website-demo',topic:'getting-started',question:'Is the dashboard on this website using real patient data?',answer:'No. The website dashboard uses fictional names and sample activity to show how the workspace looks. It does not contain real patient records or perform live clinic actions.'},
 {id:'reception-role',topic:'ai-reception',question:'What does AI reception help with?',answer:'AI reception supports routine patient questions, incoming enquiries and booking requests. Your team stays responsible for patient care and any conversation that needs a person.'},
 {id:'voice-setup',topic:'ai-reception',question:'What is needed before my clinic can handle calls?',answer:'Your workspace needs a configured voice service and the clinic information used to handle enquiries. Confirm the connection and call-handling setup before directing patient calls to it.'},
 {id:'booking',topic:'appointments',question:'How are appointments and availability organised?',answer:'Bookings are organised around your doctors and their schedules. The schedule distinguishes booked, available, held and blocked time so the front desk can review availability before arranging a visit.'},
 {id:'queue',topic:'appointments',question:'How does the patient queue work?',answer:'The queue shows Waiting, Called, With doctor and Completed stages. Call next follows the queue’s priority order. Open a card to review a patient’s queue details and any permitted status change.'},
 {id:'whatsapp-connect',topic:'whatsapp',question:'Can I use WhatsApp from my workspace?',answer:'WhatsApp features require your clinic’s authorised WhatsApp service to be connected and configured. Check that connection before relying on live conversations or outreach.'},
 {id:'message-status',topic:'whatsapp',question:'Does a prepared message mean it has been delivered?',answer:'No. A draft or prepared campaign is not proof of delivery. Review the status returned by the connected messaging service; if delivery is unavailable or unconfirmed, treat it as such.'},
 {id:'google-profile',topic:'growth',question:'What do I need to manage my Google Business Profile?',answer:'You need access to the clinic’s Google Business Profile and an authorised connection for the workspace. Review the account and location before making changes to your clinic’s public information.'},
 {id:'metrics',topic:'growth',question:'Which clinic metrics can I review?',answer:'The overview includes new bookings, visits due, check-ins, completed visits, cancellations and no-shows. Choose a reporting period, compare it with the previous period and open a metric for more detail.'},
 {id:'doctors-services',topic:'team',question:'Where do I organise doctors and clinic services?',answer:'Use Doctors to manage the clinicians in your workspace and Hospital catalogue for your clinic’s services. Keep those details and doctor availability current before arranging patient bookings.'},
 {id:'permissions',topic:'team',question:'Can every team member change workspace settings?',answer:'Access depends on the person’s workspace role and permissions. Ask your workspace administrator to review access when someone’s responsibilities change.'}
];
