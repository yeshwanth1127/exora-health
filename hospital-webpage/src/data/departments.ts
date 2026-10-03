import { Department } from '../types';

// Canonical service list. Homepage tiles, nav, footer and the booking modal all read from here.
export const departments: Department[] = [
  {
    id: "general-medicine",
    name: "Primary Care",
    tagline: "Holistic preventive health, chronic disease management, and everyday care",
    description: "Comprehensive health checkups, diabetes control, hypertension monitoring, and acute infectious disease management.",
    iconName: "Stethoscope",
    doctorCount: 10,
    commonProcedures: ["Annual Preventive Health Checkup", "Diabetes Management", "Hypertension Clinic", "Geriatric Care"]
  },
  {
    id: "cardiology",
    name: "Cardiology & Heart Health",
    tagline: "Comprehensive cardiovascular diagnostics and interventional care",
    description: "Advanced heart care with non-invasive cardiac imaging, stress testing, and rapid referral for interventional procedures.",
    iconName: "HeartPulse",
    doctorCount: 8,
    commonProcedures: ["ECG & 2D Echo", "Treadmill Stress Test", "Lipid & Risk Profiling", "Heart Failure Clinic"]
  },
  {
    id: "metabolic",
    name: "Weight Management & Metabolic Health",
    tagline: "Evidence-based weight, thyroid, and diabetes care",
    description: "Endocrinologist-led programs for obesity, PCOS, thyroid disorders, and type 2 diabetes with dietitian and physiotherapy support.",
    iconName: "Activity",
    doctorCount: 5,
    commonProcedures: ["Metabolic Panel & Body Composition", "Thyroid Clinic", "PCOS Management", "Medical Weight Loss Program"]
  },
  {
    id: "orthopedics",
    name: "Orthopedics & Joint Care",
    tagline: "Joint replacement, sports injury, and spine care",
    description: "Arthroscopic ligament reconstruction, knee & hip arthroplasty, fracture care, and supervised rehabilitation.",
    iconName: "Bone",
    doctorCount: 9,
    commonProcedures: ["Total Knee Replacement", "Arthroscopic ACL Repair", "Hip Replacement", "Fracture & Trauma Care"]
  },
  {
    id: "dermatology",
    name: "Skin Care",
    tagline: "Clinical skin wellness, allergy treatment, and laser therapy",
    description: "Evidence-based management for eczema, psoriasis, acne scar revision, skin cancer screening, and cosmetic dermatology.",
    iconName: "Sparkles",
    doctorCount: 4,
    commonProcedures: ["Skin Allergy Testing", "Laser Scar Revision", "Mole & Biopsy Screening", "Psoriasis Phototherapy"]
  },
  {
    id: "neurology",
    name: "Mental Health & Neurology",
    tagline: "Psychiatry, psychology, and neurological care under one roof",
    description: "Anxiety, depression, sleep and migraine clinics alongside epilepsy management and neurological rehabilitation.",
    iconName: "Brain",
    doctorCount: 6,
    commonProcedures: ["Psychiatric Consultation", "Therapy & Counselling", "Migraine & Headache Clinic", "EEG & EMG Studies"]
  },
  {
    id: "pediatrics",
    name: "Pediatrics & Child Health",
    tagline: "Compassionate child healthcare from newborn to adolescence",
    description: "Immunisation, growth milestone tracking, childhood asthma and allergy care, and adolescent health.",
    iconName: "Baby",
    doctorCount: 7,
    commonProcedures: ["Childhood Vaccination", "Growth & Development Tracking", "Pediatric Asthma Management", "Adolescent Health"]
  },
  {
    id: "ent",
    name: "Ear, Nose & Throat (ENT)",
    tagline: "Comprehensive care for hearing, sinuses, voice, and head-neck conditions",
    description: "Endoscopic sinus surgery, hearing assessment, snoring and sleep apnea management, and pediatric ENT care.",
    iconName: "Stethoscope",
    doctorCount: 6,
    commonProcedures: ["Nasal Endoscopy & Sinus Care", "Pure Tone Audiometry", "Micro-Ear Surgery", "Snoring & Sleep Apnea Evaluation"]
  },
  {
    id: "dental",
    name: "Dental & Oral Maxillofacial",
    tagline: "Preventative, restorative, and aesthetic dentistry",
    description: "Digital dental X-rays, root canal treatment, teeth alignment, pediatric dentistry, and dental implants.",
    iconName: "Smile",
    doctorCount: 5,
    commonProcedures: ["Root Canal Treatment (RCT)", "Clear Aligners & Braces", "Laser Teeth Whitening", "Dental Implants & Crowns"]
  }
];
