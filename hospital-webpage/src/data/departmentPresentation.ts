// Presentation copy and imagery for the frontend demo. Clinical/service data stays in departments.ts.
export const departmentPresentation: Record<string, { image: string; imageAlt: string; eyebrow: string; promise: string; highlights: [string, string, string]; tint: string }> = {
  'general-medicine': {
    image: '/images/primary-care-consultation.jpg', imageAlt: 'Doctor speaking with a patient during a consultation',
    eyebrow: 'CARE FOR EVERY DAY', promise: 'Feel better, with care that sees the whole you.',
    highlights: ['A place to start, whatever is on your mind', 'Practical support for long-term health', 'Care that fits around your life'], tint: '#e9f0df',
  },
  cardiology: {
    image: '/images/cardiology-consultation.jpg', imageAlt: 'Cardiologist discussing heart health with a patient',
    eyebrow: 'HEART & CIRCULATION', promise: 'Give your heart the attention it deserves.',
    highlights: ['Understand your heart health', 'Explore testing and treatment options', 'Plan your next step with a specialist'], tint: '#e7ece7',
  },
  metabolic: {
    image: '/images/metabolic-specialty.jpg', imageAlt: 'Nutritionist and client discussing food choices',
    eyebrow: 'METABOLIC WELLBEING', promise: 'A healthier rhythm starts with a plan made for you.',
    highlights: ['Support for weight and metabolism', 'Understand thyroid and blood sugar concerns', 'Build changes you can live with'], tint: '#e9eedf',
  },
  orthopedics: {
    image: '/images/orthopedics-specialty.jpg', imageAlt: 'Physical therapist guiding a patient through a leg exercise',
    eyebrow: 'MOVEMENT & MOBILITY', promise: 'Get back to moving like yourself.',
    highlights: ['Care for joints, bones and injuries', 'Understand your treatment options', 'A clear path through recovery'], tint: '#e8ece8',
  },
  dermatology: {
    image: '/images/dermatology-specialty.jpg', imageAlt: 'Clinician examining a patient’s skin',
    eyebrow: 'SKIN HEALTH', promise: 'Feel comfortable in your skin again.',
    highlights: ['Answers for everyday skin concerns', 'Treatment tailored to your skin', 'Support for lasting skin health'], tint: '#f0e9df',
  },
  neurology: {
    image: '/images/neurology-specialty.jpg', imageAlt: 'Therapist listening to a patient during a consultation',
    eyebrow: 'MIND & NERVOUS SYSTEM', promise: 'Space to talk, answers to move forward.',
    highlights: ['Thoughtful conversations about symptoms', 'Care for mental and neurological health', 'A plan built around your needs'], tint: '#e8e6ef',
  },
  pediatrics: {
    image: '/images/pediatrics-specialty.jpg', imageAlt: 'Pediatrician talking with a child during a checkup',
    eyebrow: 'CHILD & FAMILY CARE', promise: 'For every little milestone, and every big question.',
    highlights: ['Care from infancy through adolescence', 'Support for growth and development', 'Room for every parent question'], tint: '#edf0df',
  },
  ent: {
    image: '/images/ent-specialty.jpg', imageAlt: 'Doctor examining a patient’s ear',
    eyebrow: 'EAR, NOSE & THROAT', promise: 'Small symptoms deserve real answers.',
    highlights: ['Help with hearing, sinus and throat concerns', 'Understand what is causing your symptoms', 'Find the right next step'], tint: '#e5eee9',
  },
  dental: {
    image: '/images/dental-specialty.jpg', imageAlt: 'Dental examination room with chair and equipment',
    eyebrow: 'ORAL HEALTH', promise: 'A better dental visit starts with feeling at ease.',
    highlights: ['Everyday and restorative dental care', 'Clear options before treatment', 'A welcoming place to ask questions'], tint: '#e6eeeb',
  },
};
