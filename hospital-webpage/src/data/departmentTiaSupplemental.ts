import { departmentEditorial } from './departmentEditorial';
import { departmentPresentation } from './departmentPresentation';
import { departments } from './departments';
import type { DepartmentTiaContent, TiaServiceItem, TiaArticleItem } from './departmentTiaData';

type SupplementalId = 'metabolic' | 'neurology' | 'pediatrics' | 'ent' | 'dental';
type Symptom = { title: string; description: string };

const service = (title: string, description: string, category: string): TiaServiceItem => ({ title, description, category });

const tailored: Record<SupplementalId, {
  services: TiaServiceItem[];
  symptoms: [Symptom, Symptom, Symptom];
  articles: TiaArticleItem[];
}> = {
  metabolic: {
    services: [
      service('Metabolic panel & body composition', 'Discuss which measurements and blood tests would help explain changes in weight, energy, or blood sugar.', 'Assessment'),
      service('Thyroid review', 'Review symptoms and existing thyroid results before deciding whether further testing or treatment is appropriate.', 'Hormone health'),
      service('PCOS consultation', 'Talk through cycle changes, skin concerns, metabolic health, and options for ongoing support.', 'Hormone health'),
      service('Medical weight management', 'Explore health risks, nutrition, activity, and treatment options with a plan suited to your circumstances.', 'Care planning'),
      service('Diabetes follow-up', 'Review glucose trends, medicines, and practical steps for managing day-to-day health.', 'Long-term care'),
      service('Nutrition and movement', 'Make room for realistic food and activity changes that support the wider care plan.', 'Everyday care'),
    ],
    symptoms: [
      { title: 'Changing blood sugar', description: 'Bring recent readings or reports. A clinician can help interpret the pattern and discuss the next check or treatment step.' },
      { title: 'Thyroid symptoms', description: 'Fatigue, temperature changes, or an abnormal thyroid result are good reasons to talk through your history and options.' },
      { title: 'Weight and metabolic concerns', description: 'Weight changes can have several causes. A visit can put your goals, medicines, sleep, and health risks in context.' },
    ],
    articles: [
      {
        tag: 'METABOLIC HEALTH',
        title: 'Understanding Insulin Resistance: Early Warning Signs and Lab Biomarkers',
        snippet: 'How fasting insulin, HbA1c, and lipid ratios give early clues before type 2 diabetes develops.',
      },
      {
        tag: 'HORMONE HEALTH',
        title: 'Thyroid Antibodies vs TSH: Navigating Persistent Fatigue and Weight Shifts',
        snippet: 'Why subclinical hypothyroidism often goes unnoticed and how full thyroid panels clarify the picture.',
      },
    ],
  },
  neurology: {
    services: [
      service('Neurological consultation', 'Discuss new or ongoing neurological symptoms, previous reports, and what needs further assessment.', 'Assessment'),
      service('Mental health consultation', 'Talk through mood, anxiety, or sleep concerns and consider the right form of support.', 'Mental health'),
      service('Therapy and counselling', 'Explore whether a talking therapy or another type of mental health care fits your needs.', 'Mental health'),
      service('Migraine and headache review', 'Look at headache patterns, triggers, medicines, and the signs that may need a closer assessment.', 'Headache care'),
      service('EEG and EMG discussion', 'Understand when electrical nerve or brain tests may be useful and what they can help clarify.', 'Testing'),
      service('Ongoing care planning', 'Review what has changed since your last visit and agree on follow-up or referral steps.', 'Follow-up'),
    ],
    symptoms: [
      { title: 'Recurring headaches', description: 'Keeping track of frequency, severity, and associated symptoms can help a clinician decide what to investigate.' },
      { title: 'Sleep, mood, or anxiety', description: 'These concerns can affect daily life. A first conversation can help decide which type of care is appropriate.' },
      { title: 'Unexplained neurological changes', description: 'Describe when a symptom started, how it has changed, and any previous assessment or treatment.' },
    ],
    articles: [
      {
        tag: 'HEADACHE MEDICINE',
        title: 'Migraine vs Tension Headaches: Identifying Triggers and Preventive Protocols',
        snippet: 'A clinical guide to headache patterns, preventive medicines, and red-flag symptoms.',
      },
      {
        tag: 'NEUROLOGICAL WELLNESS',
        title: 'Brain Fog and Unexplained Fatigue: When Neurological Testing is Helpful',
        snippet: 'Distinguishing stress and sleep apnea from neurological indicators with clinical precision.',
      },
    ],
  },
  pediatrics: {
    services: [
      service('Childhood vaccinations', 'Review the child’s immunisation record and discuss the next recommended dose with a clinician.', 'Preventive care'),
      service('Growth and development', 'Talk through growth, feeding, movement, speech, and milestones in the context of the child’s age.', 'Development'),
      service('Asthma and allergy review', 'Discuss breathing symptoms, triggers, medicines, and an appropriate follow-up plan.', 'Everyday care'),
      service('Adolescent health', 'Give teenagers and families room to discuss changes, questions, and healthy routines.', 'Teen care'),
      service('Newborn checkups', 'Bring feeding, sleep, weight, or care questions to a visit focused on the baby and family.', 'Early years'),
      service('Family guidance', 'Review reports, medicines, and observations together so everyone understands the next step.', 'Support'),
    ],
    symptoms: [
      { title: 'Frequent illness or fever', description: 'Share the child’s symptoms, temperature pattern, and any medicines already given so a clinician can assess what is needed.' },
      { title: 'Growth or development questions', description: 'Every child develops at a different pace. Bring your observations and records for a measured discussion.' },
      { title: 'Breathing and allergy concerns', description: 'Recurring cough, wheeze, or suspected triggers deserve a conversation about assessment and care.' },
    ],
    articles: [
      {
        tag: 'DEVELOPMENTAL CARE',
        title: 'Infant Developmental Milestones: What to Monitor in the First 18 Months',
        snippet: 'Key indicators for motor skills, social interaction, and early speech development.',
      },
      {
        tag: 'CHILD HEALTH',
        title: 'Childhood Allergies and Asthma: Creating a Home Action Plan That Works',
        snippet: 'Recognizing early respiratory triggers and keeping young lungs clear and active.',
      },
    ],
  },
  ent: {
    services: [
      service('Sinus and nasal assessment', 'Discuss blockage, recurrent sinus symptoms, and whether an examination or endoscopy would help.', 'Nose and sinus'),
      service('Hearing assessment', 'Talk through hearing changes or tinnitus and whether audiometry is an appropriate next step.', 'Ear care'),
      service('Ear treatment options', 'Review persistent ear concerns and the available medical or procedural approaches after assessment.', 'Ear care'),
      service('Snoring and sleep breathing', 'Describe sleep symptoms and explore whether further assessment is needed.', 'Sleep'),
      service('Voice and throat review', 'Assess recurring throat discomfort, voice changes, or swallowing concerns with an ENT clinician.', 'Throat care'),
      service('Children’s ENT visit', 'Bring questions about ear, nose, or throat symptoms in a child and discuss age-appropriate care.', 'Family care'),
    ],
    symptoms: [
      { title: 'Blocked ears or hearing changes', description: 'An examination can help distinguish wax, infection, and other possible causes before treatment is chosen.' },
      { title: 'Recurring nasal or sinus symptoms', description: 'Share how long symptoms last, what triggers them, and which treatments you have already tried.' },
      { title: 'Voice or throat concerns', description: 'Persistent hoarseness, sore throat, or swallowing changes can be discussed with a clinician.' },
    ],
    articles: [
      {
        tag: 'SINUS & ALLERGY',
        title: 'Chronic Sinus Pressure: Medical Management vs In-Office Endoscopy',
        snippet: 'How ENT specialists treat chronic rhinosinusitis and improve daily nasal breathing.',
      },
      {
        tag: 'HEARING HEALTH',
        title: 'Tinnitus and Sudden Hearing Loss: Why Early Consultation is Critical',
        snippet: 'The golden window for treating inner ear inflammation and modern sound therapy options.',
      },
    ],
  },
  dental: {
    services: [
      service('Tooth pain assessment', 'An examination can help identify the cause of pain or sensitivity and the options for relief.', 'First visit'),
      service('Preventive dental care', 'Discuss checkups, cleaning, daily care, and concerns you want to address early.', 'Prevention'),
      service('Root canal consultation', 'Review symptoms and imaging, then talk through whether root canal treatment is suitable.', 'Restorative care'),
      service('Aligners and braces', 'Discuss bite or alignment goals and the assessments needed before choosing a treatment.', 'Alignment'),
      service('Implants and crowns', 'Understand restorative options, expected steps, and questions about cost before treatment.', 'Restorative care'),
      service('Teeth whitening questions', 'Ask about suitable whitening options and whether any dental concerns should be treated first.', 'Appearance'),
    ],
    symptoms: [
      { title: 'Tooth pain or sensitivity', description: 'Describe when the pain occurs, how long it lasts, and any swelling or previous treatment.' },
      { title: 'Bite or alignment questions', description: 'A dental visit can clarify which concerns are cosmetic and which may affect function.' },
      { title: 'Missing or damaged teeth', description: 'Review restoration choices after an examination and discuss timing and cost before deciding.' },
    ],
    articles: [
      {
        tag: 'PREVENTIVE DENTISTRY',
        title: 'Gum Health and Systemic Wellness: The Oral-Cardiovascular Connection',
        snippet: 'How periodontal inflammation affects blood vessels and why proactive hygiene matters.',
      },
      {
        tag: 'RESTORATIVE CARE',
        title: 'Modern Ceramic Crowns and Clear Aligners: What to Expect Step by Step',
        snippet: 'Digital scanning, 3D printing, and non-invasive cosmetic dental restoration options.',
      },
    ],
  },
};

export function getSupplementalDepartmentContent(id: SupplementalId): DepartmentTiaContent {
  const department = departments.find((item) => item.id === id);
  const presentation = departmentPresentation[id];
  const editorial = departmentEditorial[id];
  const details = tailored[id];
  if (!department || !presentation || !editorial) throw new Error(`Missing department presentation for ${id}`);

  const visitDescriptions = [
    editorial.intro,
    'Your clinician can explain which examination or test is useful for your concern before you decide how to proceed.',
    'You can review treatment choices, follow-up timing, and any questions you still have before leaving.',
  ];

  return {
    hero: {
      title: presentation.promise,
      bullets: [...presentation.highlights],
      image: presentation.image,
      imageAlt: presentation.imageAlt,
    },
    services: { heading: `Care options in ${department.name}`, items: details.services },
    symptoms: {
      heading: 'Reasons to start a conversation',
      slides: details.symptoms.map((symptom) => ({ ...symptom, image: presentation.image, imageAlt: presentation.imageAlt })),
    },
    whyMatters: {
      heading: `What to expect from ${department.name}`,
      pillars: editorial.visit.map((title, index) => ({ title, description: visitDescriptions[index] })),
    },
    cta: { heading: `Plan a ${department.name.toLowerCase()} visit`, description: editorial.intro },
    resources: {
      heading: 'Topics to discuss',
      articles: details.articles,
    },
  };
}

export function hasSupplementalDepartmentContent(id: string): id is SupplementalId {
  return Object.prototype.hasOwnProperty.call(tailored, id);
}
