export interface FaqItem {
  question: string;
  answer: string;
}

// Keep these answers in step with what the website and booking page actually do.
export const CLINIC_FAQS: FaqItem[] = [
  {
    "question": "What can I do on this website?",
    "answer": "Explore Sri Lakshmi Hospital\u2019s specialties, doctors, published health packages and group locations. This is a personalized client demo; contact the hospital to confirm appointments."
  },
  {
    "question": "Which specialties are listed?",
    "answer": "The hospital lists medical and surgical specialties including cardiology, gynecology, orthopedics, urology, nephrology, neurology, general and laparoscopic surgery, and emergency care."
  },
  {
    "question": "How do I arrange a consultation?",
    "answer": "Call +91 99017 11716 to confirm the clinician, consultation time and fee. The source website does not publish individual doctor schedules."
  },
  {
    "question": "Can I check insurance coverage here?",
    "answer": "The hospital names private insurers and government schemes on its website. Eligibility depends on your policy and treatment; contact its insurance desk for current coverage and pre-authorization."
  },
  {
    "question": "Can I view or upload medical records?",
    "answer": "The demo does not provide access to medical records. Bring relevant reports and prescriptions to your visit."
  },
  {
    "question": "Are the health-package prices current?",
    "answer": "The demo uses prices published on the hospital website and captured on 3 October 2026. Confirm current offers, included tests and preparation with reception."
  },
  {
    "question": "Where is the main hospital?",
    "answer": "#301, 3rd Cross, Old Extension, KR Puram, Bengaluru 560036. The hospital lists 24/7 services; confirm individual specialist hours before travelling."
  },
  {
    "question": "What should I do in a medical emergency?",
    "answer": "Use local emergency services or go to the nearest emergency department. Do not wait for a response from a website form or chat widget."
  }
];

export const FAMILY_FAQS = CLINIC_FAQS;
