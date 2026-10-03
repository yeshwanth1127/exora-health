export interface PackageInclusionGroup {
  category: string;
  tests: string[];
}

export interface HealthTier {
  id: string;
  name: string;
  badge: { label: string; dot: string };
  featured?: boolean;
  description: string;
  monthly: number; // ₹ per month, billed monthly
  annual: number; // ₹ per year, billed yearly
  included: string[]; // subset of membershipFeatures
}

// One shared ladder — every card lists all of these with a check or a cross.
export const membershipFeatures = [
  'Unlimited 24/7 virtual care with senior family physicians',
  'Zero wait-time priority access at all four clinics',
  'Complimentary doorstep diagnostic sample collection',
  'Annual preventive baseline screen & digital health passport',
  'Direct pediatrician WhatsApp, well visits & vaccines',
  'Full-body DEXA composition scan & abdominal sonography',
  '96+ advanced blood biomarkers (ApoB, hs-CRP, HbA1c)',
  '1-on-1 longevity physician & senior cardiologist roadmap',
  'Coronary calcium score & toxic heavy-metals screen',
  'Dedicated health navigator & multi-specialty board review',
];

const F = membershipFeatures;

export const healthTiers: HealthTier[] = [
  {
    id: 'tier-signature',
    name: 'Signature Care',
    badge: { label: 'Everyday', dot: '#e8c545' },
    description:
      'Essential, unhurried primary and urgent care for your household — 24/7 telemedicine, zero-wait clinic visits and home sample pickup.',
    monthly: 549,
    annual: 4999,
    included: F.slice(0, 4),
  },
  {
    id: 'tier-longevity',
    name: 'Longevity 360',
    badge: { label: 'Recommended', dot: '#e8f852' },
    featured: true,
    description:
      'Proactive diagnostics for life: whole-body imaging, 96+ biomarkers and a physician-led roadmap to intercept risk years before symptoms.',
    monthly: 1699,
    annual: 14999,
    included: [...F.slice(0, 4), ...F.slice(5, 8)],
  },
  {
    id: 'tier-executive',
    name: 'Executive 360',
    badge: { label: 'All-inclusive', dot: '#5da53a' },
    description:
      'Built for founders and high-performers: every screen we offer, a private suite, and a dedicated navigator who handles the system for you.',
    monthly: 2799,
    annual: 24999,
    included: F,
  },
  {
    id: 'tier-pediatrics',
    name: 'Pediatrics Care',
    badge: { label: 'Families', dot: '#e8c545' },
    description:
      'Everything in Signature plus on-site pediatricians on 24/7 standby, house calls, vaccines and allergy testing for kids that can\'t wait.',
    monthly: 999,
    annual: 8999,
    included: F.slice(0, 5),
  },
];

export interface HealthPackage {
  id: string;
  category: 'Master' | 'Full Body' | 'Cardiac / Heart' | 'Women\'s Care' | 'Executive 360';
  title: string;
  shortDescription: string;
  keyInclusionsSummary: string;
  testsCount: number;
  reportDeliveryHours: number;
  price: number;
  originalPrice: number;
  discountPercentage: number;
  headerColor: string;
  accentBg: string;
  isPopular?: boolean;
  homeCollectionAvailable: boolean;
  detailedInclusions: PackageInclusionGroup[];
}

export const healthPackages: HealthPackage[] = [
  {
    id: 'master-health-program',
    category: 'Master',
    title: 'Avocado ProHealth Master Program',
    shortDescription: 'Essential annual preventive health evaluation for proactive metabolic and organ wellness.',
    keyInclusionsSummary: 'Lipid Profile, Fasting Blood Sugar, Liver (LFT), Renal (KFT), Resting ECG, Thyroid (TSH) & Doctor Review',
    testsCount: 72,
    reportDeliveryHours: 12,
    price: 8200,
    originalPrice: 12500,
    discountPercentage: 34,
    headerColor: '#154734',
    accentBg: '#eaf3ed',
    homeCollectionAvailable: true,
    detailedInclusions: [
      {
        category: 'Blood Sugar & Metabolic',
        tests: ['Fasting Blood Glucose', 'HbA1c (3-month average)', 'Average Blood Glucose (ABG)']
      },
      {
        category: 'Heart & Cardiovascular',
        tests: ['Resting 12-Lead ECG', 'Lipid Profile (Total Cholesterol, HDL, LDL, Triglycerides, VLDL)', 'Cardiac Risk Ratio']
      },
      {
        category: 'Liver Function Panel',
        tests: ['Bilirubin (Total, Direct, Indirect)', 'SGOT / AST', 'SGPT / ALT', 'Alkaline Phosphatase', 'Total Protein & Albumin/Globulin Ratio']
      },
      {
        category: 'Kidney / Renal Health',
        tests: ['Serum Creatinine', 'Blood Urea Nitrogen (BUN)', 'Uric Acid', 'Electrolytes (Sodium, Potassium, Chloride)', 'Complete Urine Analysis']
      },
      {
        category: 'Thyroid & Hematology',
        tests: ['TSH (Ultrasensitive)', 'Complete Blood Count (CBC with 24 parameters)', 'Erythrocyte Sedimentation Rate (ESR)']
      },
      {
        category: 'Consultations',
        tests: ['1-on-1 Comprehensive Physician Consultation', 'Personalized Lifestyle & Nutrition Advisory']
      }
    ]
  },
  {
    id: 'regal-whole-body-program',
    category: 'Full Body',
    title: 'Apollo ProHealth Regal Whole Body Program',
    shortDescription: 'The gold-standard 360° health screening with advanced imaging, cardiovascular stress tests, and cancer biomarkers.',
    keyInclusionsSummary: 'TMT, 2D Echo with Doppler, Ultrasound Abdomen, Bone Mineral DEXA, Vitamin D3/B12 & Cancer Screening',
    testsCount: 96,
    reportDeliveryHours: 24,
    price: 16400,
    originalPrice: 24800,
    discountPercentage: 34,
    headerColor: '#0d5045',
    accentBg: '#e5f3f0',
    isPopular: true,
    homeCollectionAvailable: true,
    detailedInclusions: [
      {
        category: 'Cardiovascular Suite',
        tests: ['TMT (Computerized Treadmill Stress Test)', '2D Echocardiogram with Color Doppler', 'Resting 12-Lead ECG', 'Apolipoprotein A1 & B']
      },
      {
        category: 'Diagnostic Radiology & Imaging',
        tests: ['Ultrasound Sonography of Abdomen & Pelvis', 'Digital Chest X-Ray (PA View)', 'DEXA Bone Mineral Density (BMD)']
      },
      {
        category: 'Vitamins & Micronutrients',
        tests: ['Vitamin D3 (25-OH)', 'Vitamin B12 Level', 'Calcium & Phosphorus', 'Serum Ferritin & Iron Studies']
      },
      {
        category: 'Early Cancer Screening',
        tests: ['PSA (for males) / Pap Smear & Breast Exam (for females)', 'Stool Occult Blood Test', 'Carcinoembryonic Antigen (CEA)']
      },
      {
        category: 'Complete Organ Panels',
        tests: ['Expanded Liver Function Test (11 tests)', 'Complete Renal Function Profile', 'Thyroid Profile (T3, T4, TSH)', 'HbA1c & Fasting Insulin']
      },
      {
        category: 'Specialist Reviews',
        tests: ['Senior Consultant Physician Review', 'Cardiologist Consultation', 'Clinical Dietitian Assessment']
      }
    ]
  },
  {
    id: 'advanced-cardiac-care',
    category: 'Cardiac / Heart',
    title: 'Avocado Advanced Heart & Vascular Care',
    shortDescription: 'Targeted cardiovascular diagnostic evaluation designed for early detection of arterial blockages and heart strain.',
    keyInclusionsSummary: '2D Echo + TMT Stress Test + Pulmonary Function, High-Sensitivity CRP, Homocysteine & Senior Cardiologist Consult',
    testsCount: 58,
    reportDeliveryHours: 12,
    price: 13800,
    originalPrice: 20900,
    discountPercentage: 34,
    headerColor: '#c28b24',
    accentBg: '#fbf4e6',
    homeCollectionAvailable: true,
    detailedInclusions: [
      {
        category: 'Heart Imaging & Stress Tests',
        tests: ['Color 2D Echocardiography', 'TMT (Treadmill Exercise Test)', 'High-Resolution 12-Lead ECG', 'Spirometry (Pulmonary Function Test)']
      },
      {
        category: 'Vascular Inflammation & Risk Biomarkers',
        tests: ['hs-CRP (High-Sensitivity C-Reactive Protein)', 'Serum Homocysteine', 'Lipoprotein (a) [Lp(a)]', 'Apolipoproteins A1 and B']
      },
      {
        category: 'Cardiometabolic Evaluation',
        tests: ['Comprehensive Lipid Sub-fractions', 'Fasting Blood Sugar & HbA1c', 'Renal Function & Serum Electrolytes']
      },
      {
        category: 'Clinical Review',
        tests: ['Dedicated Senior Interventional Cardiologist Consultation', 'Personalized Cardiac Exercise & Diet Roadmap']
      }
    ]
  },
  {
    id: 'womens-wellness-program',
    category: 'Women\'s Care',
    title: 'Avocado Women\'s Vitality & Hormonal Health',
    shortDescription: 'Curated by leading gynecologists for hormonal harmony, bone preservation, reproductive and breast wellness.',
    keyInclusionsSummary: 'Hormonal Trio (LH/FSH/Prolactin), Mammography/Breast USG, Pap Smear, Thyroid Profile & Vitamin D3/B12',
    testsCount: 78,
    reportDeliveryHours: 24,
    price: 9400,
    originalPrice: 14500,
    discountPercentage: 35,
    headerColor: '#8b2643',
    accentBg: '#faedf2',
    homeCollectionAvailable: true,
    detailedInclusions: [
      {
        category: 'Hormonal & Endocrine',
        tests: ['FSH (Follicle Stimulating Hormone)', 'LH (Luteinizing Hormone)', 'Serum Prolactin', 'Total & Free Testosterone', 'Thyroid Profile (T3, T4, TSH)']
      },
      {
        category: 'Reproductive & Preventive Screening',
        tests: ['Liquid-based Pap Smear (Cervical Screening)', 'Pelvic & Transabdominal Ultrasound', 'Bilateral Sono-Mammography / Clinical Breast Exam']
      },
      {
        category: 'Anemia & Bone Vitality',
        tests: ['Complete Hemogram & Serum Ferritin', 'Iron Binding Capacity (TIBC)', 'Vitamin D3 & Calcium', 'Vitamin B12']
      },
      {
        category: 'Consultations',
        tests: ['Senior Obstetrician & Gynecologist Consultation', 'Wellness Nutritionist Lifestyle Consultation']
      }
    ]
  },
  {
    id: 'executive-vitality-360',
    category: 'Executive 360',
    title: 'Avocado Executive 360 Leadership Wellness',
    shortDescription: 'Comprehensive diagnostic suite with non-invasive whole-body imaging, heavy metals, and multi-specialist board review.',
    keyInclusionsSummary: 'CT Chest / Ultrasound, Carotid Doppler, Genetic Risk Screen, Comprehensive Cancer Biomarkers & Board Review',
    testsCount: 114,
    reportDeliveryHours: 36,
    price: 22500,
    originalPrice: 34000,
    discountPercentage: 34,
    headerColor: '#1e293b',
    accentBg: '#f1f5f9',
    homeCollectionAvailable: true,
    detailedInclusions: [
      {
        category: 'Advanced Imaging & Doppler',
        tests: ['Low-Dose High-Resolution CT Chest', 'Carotid Artery Intima-Media Doppler', 'Whole Abdomen & Pelvis Doppler USG']
      },
      {
        category: 'Cardiovascular & Lung Performance',
        tests: ['Stress TMT Test', 'Color 2D Echo', 'Extended Pulmonary Function Test', 'hs-CRP & Cardiac Biomarkers']
      },
      {
        category: 'Extended Cancer Markers',
        tests: ['CEA', 'CA 19-9', 'AFP', 'PSA (Males) / CA 125 (Females)', 'Stool Occult Blood']
      },
      {
        category: 'Metabolic & Micronutrient Matrix',
        tests: ['Magnesium, Zinc, Copper, Selenium', 'Vitamin Profile (A, D, E, K, B-Complex)', 'Heavy Metals Screen (Lead, Mercury, Arsenic)']
      },
      {
        category: 'Executive Health Board',
        tests: ['Multi-Specialty Board Consultation (Physician, Cardiologist, Dietitian)', 'Executive Health Concierge & Fast-track OPD']
      }
    ]
  }
];
