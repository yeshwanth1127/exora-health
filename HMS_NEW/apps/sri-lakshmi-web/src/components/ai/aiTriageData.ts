import { branches } from '../../data/branches';

export interface TriageSpecialty {
  id: string;
  name: string;
  departmentId: string;
  iconName: string;
  prompt: string;
  options: {
    id: string;
    title: string;
    description: string;
    recommendedDoctorId?: string;
    urgency?: 'urgent' | 'standard';
  }[];
}

export const POPULAR_SPECIALTIES = [
  {
    "id": "general-medicine",
    "name": "General Medicine",
    "departmentId": "general-medicine",
    "icon": "Stethoscope"
  },
  {
    "id": "obgyn",
    "name": "OB-GYN",
    "departmentId": "gynecology",
    "icon": "User"
  },
  {
    "id": "dermatology",
    "name": "Dermatology",
    "departmentId": "dermatology",
    "icon": "Sparkles"
  },
  {
    "id": "cardiology",
    "name": "Cardiology",
    "departmentId": "cardiology",
    "icon": "HeartPulse"
  },
  {
    "id": "ent",
    "name": "Ear, Nose, Throat",
    "departmentId": "ent",
    "icon": "Headphones"
  },
  {
    "id": "urology",
    "name": "Urology",
    "departmentId": "urology",
    "icon": "Stethoscope"
  },
  {
    "id": "neurology",
    "name": "Neurology",
    "departmentId": "neurology",
    "icon": "Brain"
  },
  {
    "id": "orthopedics",
    "name": "Orthopedics",
    "departmentId": "orthopedics",
    "icon": "Bone"
  }
];

export const TRIAGE_DATA: Record<string, TriageSpecialty> = {
  ent: {
    id: 'ent',
    name: 'Ear, Nose, Throat',
    departmentId: 'ent',
    iconName: 'Headphones',
    prompt: 'Why are you looking for an ear, nose & throat doctor?',
    options: [
      {
        id: 'ear-hearing',
        title: 'Treat an ear or hearing problem',
        description: 'Ear pain, infection, hearing loss, ringing, dizziness, wax buildup, or ear surgery',
      },
      {
        id: 'nose-sinus',
        title: 'Treat a nose, sinus, or allergy issue',
        description: 'Sinus pain, congestion, nose bleeds, allergies, loss of smell, or nose surgery',
      },
      {
        id: 'throat-voice',
        title: 'Treat a throat, voice, or mouth problem',
        description: 'Sore throat, tonsils, hoarseness, swallowing, cough, or mouth and jaw issues',
      },
      {
        id: 'urgent-ent',
        title: 'Get an urgent ENT visit',
        description: 'A sudden ear, nose, or throat problem that needs same-day attention',
        urgency: 'urgent',
      },
      {
        id: 'neck-salivary',
        title: 'Address a neck, head, or salivary issue',
        description: 'Neck lumps, thyroid nodules, salivary glands, head and neck tumors, or skin rash',
      },
      {
        id: 'snoring-sleep',
        title: 'Get help with snoring or sleep',
        description: 'Snoring, sleep apnea, trouble sleeping, or a sleep study',
      },
    ],
  },
  'general-medicine': {
    id: 'general-medicine',
    name: 'Primary Care',
    departmentId: 'general-medicine',
    iconName: 'Stethoscope',
    prompt: 'Why are you looking for a primary care doctor?',
    options: [
      {
        id: 'everyday-illness',
        title: 'Everyday sickness or acute infection',
        description: 'Fever, cough, viral chills, gastrointestinal upset, body aches, or acute fatigue',
        recommendedDoctorId: 'doc-2',
      },
      {
        id: 'chronic-care',
        title: 'Manage an ongoing chronic health condition',
        description: 'Diabetes monitoring, hypertension management, thyroid care, or metabolic profiling',
        recommendedDoctorId: 'doc-2',
      },
      {
        id: 'annual-screening',
        title: 'Comprehensive annual preventative checkup',
        description: 'Holistic full-body blood panel, ECG, biometric risk audit, and preventive review',
        recommendedDoctorId: 'doc-2',
      },
      {
        id: 'prescription-refill',
        title: 'Prescription review or lab report interpretation',
        description: 'Second opinion on diagnostic pathology reports and chronic medication renewals',
        recommendedDoctorId: 'doc-2',
      },
    ],
  },
  dermatology: {
    id: 'dermatology',
    name: 'Dermatologist',
    departmentId: 'dermatology',
    iconName: 'Sparkles',
    prompt: 'Why are you looking for a skin & hair specialist?',
    options: [
      {
        id: 'acne-breakouts',
        title: 'Acne, breakouts, or facial blemishes',
        description: 'Cystic acne, blackheads, hormonal flare-ups, and laser scar revision therapies',
      },
      {
        id: 'rash-eczema',
        title: 'Unusual rash, itching, or eczema',
        description: 'Dry flaking skin, psoriasis plaques, contact allergy testing, or urticaria',
      },
      {
        id: 'hair-loss',
        title: 'Hair fall, thinning, or scalp condition',
        description: 'Excessive hair shedding, male/female pattern alopecia, or scalp dermatitis',
      },
      {
        id: 'mole-check',
        title: 'Mole evaluation or preventative skin biopsy',
        description: 'Screening changing moles, skin tags, cysts, and benign lesion removals',
      },
    ],
  },
  dental: {
    id: 'dental',
    name: 'Dentist',
    departmentId: 'dental',
    iconName: 'Smile',
    prompt: 'Why are you looking for a dental surgeon?',
    options: [
      {
        id: 'tooth-pain',
        title: 'Toothache, cavity, or sensitive tooth',
        description: 'Sharp nerve pain, throbbing tooth discomfort, hot/cold sensitivity, or fillings',
      },
      {
        id: 'cleaning-checkup',
        title: 'Routine teeth cleaning & oral hygiene exam',
        description: 'Plaque and tartar scaling, enamel polish, gum disease check, and digital X-rays',
      },
      {
        id: 'root-canal',
        title: 'Root canal treatment (RCT) & crowns',
        description: 'Painless single-sitting computerized endodontics and zirconium crown fittings',
      },
      {
        id: 'aligners-cosmetic',
        title: 'Clear aligners, braces, or smile makeover',
        description: 'Invisible teeth aligners, cosmetic composite veneers, and laser whitening',
      },
    ],
  },
  orthopedics: {
    id: 'orthopedics',
    name: 'Orthopedist',
    departmentId: 'orthopedics',
    iconName: 'Bone',
    prompt: 'Why are you looking for an orthopedic specialist?',
    options: [
      {
        id: 'knee-joint',
        title: 'Knee pain, arthritis, or joint stiffness',
        description: 'Difficulty climbing stairs, cartilage wear, osteoarthritis, or joint lubrication',
        recommendedDoctorId: 'doc-3',
      },
      {
        id: 'spine-back',
        title: 'Back, neck, or sciatica discomfort',
        description: 'Lumbar pain, herniated disc, posture strain, or radiating leg numbness',
        recommendedDoctorId: 'doc-3',
      },
      {
        id: 'sports-ligament',
        title: 'Sports injury or ligament tear',
        description: 'Ankle sprains, meniscus tears, ACL reconstruction, or shoulder rotator cuff strain',
        recommendedDoctorId: 'doc-3',
      },
      {
        id: 'fracture-fall',
        title: 'Recent fall, suspected fracture, or trauma',
        description: 'Immediate X-ray imaging, plaster cast immobilization, or fracture reduction',
        recommendedDoctorId: 'doc-3',
        urgency: 'urgent',
      },
    ],
  },
  cardiology: {
    id: 'cardiology',
    name: 'Cardiologist',
    departmentId: 'cardiology',
    iconName: 'Heart',
    prompt: 'Why are you looking for a cardiology & heart specialist?',
    options: [
      {
        id: 'chest-discomfort',
        title: 'Chest heaviness or shortness of breath',
        description: 'Exertional chest tightness, fatigue during walking, or non-emergency cardiac check',
        recommendedDoctorId: 'doc-1',
      },
      {
        id: 'palpitations',
        title: 'Palpitations or rapid irregular heartbeat',
        description: 'Fluttering in chest, racing pulse at rest, skipped beats, or dizzy spells',
        recommendedDoctorId: 'doc-1',
      },
      {
        id: 'hypertension-lipid',
        title: 'High blood pressure or elevated cholesterol',
        description: 'Cardiac risk profiling, calcium score review, and medical lipid optimization',
        recommendedDoctorId: 'doc-1',
      },
      {
        id: 'ecg-tmt',
        title: '2D Echo & Treadmill Stress Test review',
        description: 'Comprehensive non-invasive heart evaluation and pre-operative cardiac clearance',
        recommendedDoctorId: 'doc-1',
      },
    ],
  },
  neurology: {
    id: 'neurology',
    name: 'Psychiatrist & Neurologist',
    departmentId: 'neurology',
    iconName: 'Brain',
    prompt: 'Why are you looking for a mental health or neurology specialist?',
    options: [
      {
        id: 'anxiety-stress',
        title: 'Anxiety, panic, or persistent stress',
        description: 'Restlessness, racing thoughts, chest tightness from stress, or work burnout',
        recommendedDoctorId: 'doc-7',
      },
      {
        id: 'sleep-insomnia',
        title: 'Sleep disturbances or chronic insomnia',
        description: 'Trouble falling asleep, frequent awakenings, or non-restorative sleep patterns',
        recommendedDoctorId: 'doc-7',
      },
      {
        id: 'migraine-headache',
        title: 'Chronic migraines or severe headaches',
        description: 'Throbbing one-sided head pain, sensory aura, photophobia, or tension headaches',
        recommendedDoctorId: 'doc-7',
      },
      {
        id: 'mood-depression',
        title: 'Depressive moods or emotional exhaustion',
        description: 'Persistent low energy, loss of enjoyment, or feeling emotionally drained',
        recommendedDoctorId: 'doc-7',
      },
    ],
  },
  obgyn: {
    id: 'obgyn',
    name: 'OB-GYN & Women\'s Health',
    departmentId: 'general-medicine',
    iconName: 'User',
    prompt: 'Why are you looking for an OB-GYN doctor?',
    options: [
      {
        id: 'pcos-period',
        title: 'Irregular periods, PCOS, or pelvic cramps',
        description: 'Menstrual cycle irregularities, hormonal acne, weight gain, or severe period pain',
        recommendedDoctorId: 'doc-4',
      },
      {
        id: 'pregnancy-antenatal',
        title: 'Pregnancy confirmation & antenatal care',
        description: 'First trimester scans, pregnancy blood panels, and trimester milestone planning',
        recommendedDoctorId: 'doc-4',
      },
      {
        id: 'fertility-preconception',
        title: 'Pre-conception checkup & fertility planning',
        description: 'Ovulation tracking, reproductive health profiling, and fertility counselling',
        recommendedDoctorId: 'doc-4',
      },
      {
        id: 'annual-wellwoman',
        title: 'Well-woman annual health checkup',
        description: 'Pap smear screening, breast examination, and preventative wellness evaluation',
        recommendedDoctorId: 'doc-4',
      },
    ],
  },
};

export const INSURANCE_PROVIDERS = [
  'Star Health Insurance',
  'HDFC ERGO General Insurance',
  'ICICI Lombard Health Care',
  'Care Health Insurance (Religare)',
  'Niva Bupa Health Insurance (Max Bupa)',
  'Bajaj Allianz Health Guard',
  'Tata AIG MediCare',
  'Aditya Birla Active Health',
  'Other Corporate TPA / Ayushman Bharat',
];

// Single source: data/branches.ts
export const CLINIC_LOCATIONS = ['All Bengaluru branches', ...branches.map((b) => b.name)];
