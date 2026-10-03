import { HospitalConfig } from '../types';

export const hospitalInfo: HospitalConfig = {
  name: "Avocado Health Clinics Private Limited",
  shortName: "Avocado Health",
  tagline: "Unhurried, modern primary and specialist care in Bengaluru",
  phone: "+91 80 4968 2800",
  emergencyPhone: "+91 80 4968 2800",
  ambulancePhone: "108",
  whatsappNumber: "918049682800", // International format without symbols for wa.me link
  defaultWhatsAppMessage: "Hello Avocado Health, I would like to book an OPD consultation.",
  email: "care@avocadohealth.in",
  address: {
    street: "100 Feet Road, HAL 2nd Stage, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    zip: "560038",
    mapsUrl: "https://maps.google.com/?q=100+Feet+Road+Indiranagar+Bengaluru"
  },
  emergencyOpen24x7: true,
  opdHours: "Mon - Sat: 8:00 AM - 8:00 PM | Sun: 9:00 AM - 2:00 PM"
};

export const whatsAppQuickOptions = [
  {
    id: "appointment",
    title: "Book Doctor Appointment",
    description: "Connect with our booking desk to reserve a slot",
    message: "Hi! I would like to book a doctor consultation at Avocado Health."
  },
  {
    id: "emergency",
    title: "Urgent Medical Assistance",
    description: "Direct connection to the on-call triage nurse",
    message: "URGENT: I need immediate medical triage assistance at Avocado Health."
  },
  {
    id: "reports",
    title: "Lab & Diagnostic Reports",
    description: "Receive your blood test or radiology results on WhatsApp",
    message: "Hello, I would like to retrieve my recent diagnostic test reports."
  },
  {
    id: "general",
    title: "General Inquiries & Pricing",
    description: "Cashless insurance, OPD schedules & health packages",
    message: "Hello! Could you share information regarding cashless insurance tie-ups and OPD consultation fees?"
  }
];
