export interface DepartmentEditorial {
  intro: string;
  concerns: string[];
  visit: [string, string, string];
  question: string;
  answer: string;
}

// Patient-facing prompts; the canonical services and clinicians live in departments.ts and doctors.ts.
export const departmentEditorial: Record<string, DepartmentEditorial> = {
  gynecology: {
    intro: 'Finally, gynecology and reproductive health care that actually listens to your body, your pain, and your questions.',
    concerns: ['Painful periods, cramps, or pelvic pain', 'Cycle irregularities or missed periods', 'Birth control options and IUD consultations', 'Perimenopause and menopause support'],
    visit: ['Talk through symptoms, cycle history, and goals', 'Gentle examination and screening if appropriate', 'Leave with a clear, personalized care plan'],
    question: 'Do I have to do a pelvic exam during my first visit?',
    answer: 'No. Exams are always collaborative and conducted only with your full consent. We move at your pace.',
  },
  'general-medicine': {
    intro: 'For a new symptom, a regular checkup, or a condition you have managed for years, primary care helps put the pieces together.',
    concerns: ['A new symptom or health question', 'Blood pressure and diabetes follow up', 'Preventive checks and screening', 'Care for older adults'],
    visit: ['Talk through your history and concerns', 'Review the checks that make sense for you', 'Leave with a follow up plan or referral'],
    question: 'Do I need to know which specialist to see first?',
    answer: 'No. Primary care can be your first stop. Your clinician can assess the concern and discuss whether specialist care is needed.',
  },
  cardiology: {
    intro: 'From blood pressure and cholesterol to palpitations and ongoing heart conditions, a cardiology visit starts with a clear picture of your health.',
    concerns: ['Chest discomfort or breathlessness', 'Palpitations or an irregular heartbeat', 'High blood pressure or cholesterol', 'Follow up after a heart diagnosis'],
    visit: ['Discuss symptoms, medicines, and family history', 'Review whether an ECG, echo, or other test is appropriate', 'Agree on treatment and follow up'],
    question: 'Will I need a heart test at my first appointment?',
    answer: 'Your cardiologist will review your symptoms and history first, then advise whether testing such as an ECG or echo is appropriate.',
  },
  metabolic: {
    intro: 'Weight, blood sugar, hormones, and sleep often affect each other. We look at the full picture before discussing a realistic plan.',
    concerns: ['Type 2 diabetes or changing blood sugar', 'Thyroid symptoms or abnormal results', 'Weight concerns and related health risks', 'PCOS and metabolic symptoms'],
    visit: ['Review your history, goals, and prior results', 'Discuss tests or body measurements if useful', 'Build a plan with realistic follow up'],
    question: 'Do I need recent blood tests before I visit?',
    answer: 'Bring any recent reports you already have. Your clinician can advise which additional tests, if any, would help.',
  },
  orthopedics: {
    intro: 'Pain and injury can change how you move through the day. Orthopedic care begins by finding the cause and weighing your options together.',
    concerns: ['Knee, hip, shoulder, or back pain', 'Sports injuries and ligament concerns', 'Fractures or injuries that are not healing as expected', 'Questions about joint replacement'],
    visit: ['Examine the affected area and movement', 'Review existing scans or discuss whether imaging is needed', 'Compare treatment and rehabilitation options'],
    question: 'Does seeing an orthopedic doctor mean I need surgery?',
    answer: 'No. An orthopedic assessment can include non surgical treatment, rehabilitation, and surgery only when appropriate.',
  },
  dermatology: {
    intro: 'Skin concerns are personal. A dermatology visit gives you space to explain what has changed and understand the options available.',
    concerns: ['Persistent acne, eczema, or psoriasis', 'A changing mole or skin mark', 'Rashes, irritation, and allergies', 'Scarring or cosmetic skin questions'],
    visit: ['Talk through symptoms, products, and prior treatments', 'Examine the area and discuss any needed tests', 'Choose a treatment and review plan'],
    question: 'Should I stop using my skin products before the visit?',
    answer: 'Bring a list or photos of the products and medicines you use. The clinician can advise on any changes after the assessment.',
  },
  neurology: {
    intro: 'Headaches, sleep, mood, and neurological symptoms can be hard to explain. We start by listening carefully and finding the right type of support.',
    concerns: ['Recurring headaches or migraine', 'Sleep, anxiety, or mood concerns', 'Seizures or other neurological symptoms', 'Questions about therapy or counselling'],
    visit: ['Describe what you have been experiencing', 'Review history, medicines, and any prior reports', 'Discuss the right assessment, treatment, or referral'],
    question: 'How do I know whether to see neurology or mental health?',
    answer: 'You do not need to decide alone. Share your main concern when booking and the team can help you choose an appropriate starting point.',
  },
  pediatrics: {
    intro: 'From newborn checks to adolescent health, pediatric care gives families time to ask, understand, and plan the next step.',
    concerns: ['Vaccinations and routine checks', 'Growth or development questions', 'Asthma, allergies, or frequent illness', 'Teenage health concerns'],
    visit: ['Talk through your child’s symptoms and routine', 'Review growth, records, and vaccination history', 'Agree on care and follow up with the family'],
    question: 'What should I bring to my child’s appointment?',
    answer: 'Bring any vaccination record, recent reports, current medicines, and notes about the questions you want to discuss.',
  },
  ent: {
    intro: 'Hearing changes, sinus problems, snoring, and voice concerns can affect everyday life. An ENT assessment helps identify what is going on.',
    concerns: ['Blocked ears or hearing changes', 'Recurring sinus or nasal symptoms', 'Sore throat, voice, or swallowing concerns', 'Snoring and sleep related breathing concerns'],
    visit: ['Describe symptoms and their pattern', 'Examine the affected area and review prior reports', 'Discuss testing, treatment, or follow up'],
    question: 'Will I need a hearing test or endoscopy?',
    answer: 'Your ENT clinician will assess the concern first and explain whether a hearing test, endoscopy, or other examination is useful.',
  },
  dental: {
    intro: 'Whether you need a checkup, have tooth pain, or are considering restorative care, we start with an examination and a clear conversation.',
    concerns: ['Tooth pain or sensitivity', 'Routine cleaning and preventive care', 'Bite, alignment, or missing teeth', 'Questions about a root canal or implant'],
    visit: ['Talk through symptoms and dental history', 'Examine your teeth and review any needed imaging', 'Explain treatment choices, timing, and cost'],
    question: 'Will treatment happen at the first visit?',
    answer: 'That depends on the concern and the treatment needed. Your dentist can explain the options after examining you.',
  },
};
