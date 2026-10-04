import { HospitalConfig } from '../types';

export const hospitalInfo: HospitalConfig = {
  name: "Sri Lakshmi Super Speciality Hospital",
  shortName: "Sri Lakshmi Hospital",
  tagline: "Specialist hospital care for families in KR Puram, Bengaluru",
  phone: "+91 99017 11716",
  emergencyPhone: "+91 99017 11716",
  ambulancePhone: "108",
  whatsappNumber: "919901711716", // International format without symbols for wa.me link
  defaultWhatsAppMessage: "Hello Sri Lakshmi Hospital, I would like to book an OPD consultation.",
  email: "lakshmihospital@yahoo.co.in",
  address: {
    street: "#301, 3rd Cross, Old Extension, KR Puram",
    city: "Bengaluru",
    state: "Karnataka",
    zip: "560036",
    mapsUrl: "https://maps.google.com/?q=Sri+Lakshmi+Super+Speciality+Hospital+KR+Puram+Bengaluru"
  },
  emergencyOpen24x7: true,
  opdHours: "Hospital open 24/7; specialist consultation hours must be confirmed"
};

export const whatsAppQuickOptions = [
  {
    id: "appointment",
    title: "Book Doctor Appointment",
    description: "Connect with our booking desk to reserve a slot",
    message: "Hi! I would like to book a doctor consultation at Sri Lakshmi Hospital."
  },
  {
    id: "emergency",
    title: "Urgent Medical Assistance",
    description: "Contact the hospital for urgent assistance",
    message: "URGENT: I need immediate medical triage assistance at Sri Lakshmi Hospital."
  },
  {
    id: "reports",
    title: "Lab & Diagnostic Reports",
    description: "Ask the hospital about collecting laboratory and diagnostic reports",
    message: "Hello, I would like to retrieve my recent diagnostic test reports."
  },
  {
    id: "general",
    title: "General Inquiries & Pricing",
    description: "Cashless insurance, OPD schedules & health packages",
    message: "Hello! Could you share information regarding cashless insurance tie-ups and OPD consultation fees?"
  }
];
