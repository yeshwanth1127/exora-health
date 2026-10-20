export interface BlogPost {
  id: string;
  title: string;
  tags: string[];
  excerpt: string;
  readingMinutes: number;
  sections: { heading?: string; paragraphs: string[] }[];
}

// Editorial samples for the frontend. No publication date, clinician byline, or medical
// review is invented. Replace this collection with reviewed CMS content before launch.
export const BLOG_POSTS: BlogPost[] = [
  {
    id: 'before-your-first-specialist-visit',
    title: 'Before your first specialist visit, make one useful page',
    tags: ['Appointments', 'Getting ready'],
    excerpt: 'A little preparation can make the conversation easier. Here is a short, practical way to bring the details that matter without arriving with a suitcase of paperwork.',
    readingMinutes: 3,
    sections: [
      { heading: 'Start with what changed', paragraphs: [
        'A specialist will want to know what brought you in. Write the main concern in your own words, then add when it began and what has changed since. “My knee has hurt for three weeks and stairs are harder now” is more useful than trying to guess a diagnosis.',
        'If you have several questions, put the most important one first. Appointments can move quickly, and it helps to leave with an answer to the question that made you book in the first place.'
      ] },
      { heading: 'Bring the details you would otherwise forget', paragraphs: [
        'Make a list of medicines and supplements you currently take, including the dose if you know it. Add any allergies, recent test reports, relevant scans, and the names of clinicians you have already seen for this concern. Photos on your phone are often easier to find than loose sheets in a bag.',
        'A timeline does not need to look polished. A few dated lines are enough: when the symptom started, what seemed to make it better or worse, and what you have already tried.'
      ] },
      { heading: 'Before you leave', paragraphs: [
        'Ask what the next step is, when to expect any results, and who to contact if you have a question afterward. If instructions are unclear, ask for them in writing. That is a normal part of a good visit.',
        'This checklist helps you prepare for a conversation; it is not a substitute for medical advice. For urgent or severe symptoms, seek appropriate local emergency care.'
      ] }
    ]
  },
  {
    id: 'questions-about-consultation-costs',
    title: 'Five cost questions to ask before you book a consultation',
    tags: ['Costs', 'Appointments'],
    excerpt: 'A displayed consultation price rarely tells the whole story. These questions can help you understand what you may actually pay.',
    readingMinutes: 3,
    sections: [
      { heading: 'Start with the visit itself', paragraphs: [
        'Ask for the fee for the exact visit type you are booking: first visit, follow-up, in-person, or video. Also ask how long that fee remains valid. A follow-up may be included, discounted, or charged separately; there is no universal rule.',
        'If you need a procedure or test, ask whether it is included in the consultation price. It often is not. You can request an estimate before agreeing to additional services.'
      ] },
      { heading: 'Check the payment details', paragraphs: [
        'If you plan to use insurance, ask the clinic and insurer to confirm the specific clinician, location, and service under your plan. “We accept your insurer” may still leave exclusions, copays, or limits that depend on your policy.',
        'Ask when payment is due, what happens if you need to cancel, and how refunds work. Save the answer along with your booking details.'
      ] },
      { heading: 'A simple script', paragraphs: [
        'You can ask: “What is the total expected charge for this first consultation, what could cost extra, and what is the cancellation policy?” A clear answer now can prevent a difficult conversation at reception later.',
        'Prices and coverage depend on the real clinic and policy. This website cannot verify a live quote.'
      ] }
    ]
  },
  {
    id: 'make-a-video-visit-work',
    title: 'The ten-minute check before a video appointment',
    tags: ['Video visits', 'Getting ready'],
    excerpt: 'The most useful video-visit preparation is ordinary: a working connection, a quiet place, and the right information nearby.',
    readingMinutes: 2,
    sections: [
      { heading: 'Test the boring things first', paragraphs: [
        'Open the appointment link before the start time. Check your camera, microphone, sound, and internet connection. Keep your phone charged in case you need to switch devices.',
        'Choose a place where you can speak privately. If you need an interpreter or someone to help you during the visit, tell the care team in advance so everyone knows who will be present.'
      ] },
      { heading: 'Keep your notes within reach', paragraphs: [
        'Have your medicine list, recent reports, and top questions ready. If you need to show a document or photo, ask the clinic which secure channel to use. Avoid sending sensitive records to an unverified number or personal email.',
        'At the end, repeat back any next steps in your own words. Ask how prescriptions, test requests, or follow-up information will reach you.'
      ] },
      { heading: 'Know the limit of the format', paragraphs: [
        'Some concerns need an in-person examination or urgent care. Your clinician can tell you if a video visit is suitable for your situation. For a medical emergency, use local emergency services rather than waiting for a virtual appointment.'
      ] }
    ]
  },
  {
    id: 'one-place-for-health-records',
    title: 'A small system for keeping your health records together',
    tags: ['Records', 'Getting ready'],
    excerpt: 'You do not need a perfect filing system. A named folder and a simple timeline are usually enough to make the next visit less frustrating.',
    readingMinutes: 3,
    sections: [
      { heading: 'Collect what you already have', paragraphs: [
        'Start with the documents that are hardest to reconstruct: discharge summaries, procedure notes, imaging reports, laboratory results, and current prescriptions. Keep the original file names if they are helpful, but add a date and short description when a file is hard to recognize.',
        'A paper folder works. So does a secure digital folder you can access on your phone. The best system is the one you can actually find when someone asks for a report.'
      ] },
      { heading: 'Add a one-page timeline', paragraphs: [
        'Write down major diagnoses, procedures, allergies, and medicine changes with approximate dates. If you do not know an exact date, say so. A rough but honest timeline is better than a confident guess.',
        'Keep this page separate from the original records. It is a guide to help you and your clinician find the right document, not a replacement for the report itself.'
      ] },
      { heading: 'Share carefully', paragraphs: [
        'Before sending records, confirm that the clinic gave you a secure upload method and that you have the right recipient. Share only what is needed for that visit. If a family member helps manage your records, agree on who can access them and how.',
        'After a visit, add the new summary or prescription while it is still easy to find. That small habit is more useful than a complicated system you will not maintain.'
      ] }
    ]
  },
  {
    id: 'make-the-most-of-a-follow-up',
    title: 'What to bring to a follow-up appointment',
    tags: ['Appointments', 'Getting ready'],
    excerpt: 'A follow-up is easier when you can say what happened after the first visit, including the parts of the plan that did not work for you.',
    readingMinutes: 2,
    sections: [
      { heading: 'Look back at the plan', paragraphs: [
        'Find the notes or instructions from your last visit. Which steps did you complete? Which ones were difficult? Bring results and reports that arrived afterward, even if you think the clinic already has a copy.',
        'Write down any changes you noticed since that visit. A short note with dates can help more than trying to remember everything in the room.'
      ] },
      { heading: 'Say what was hard', paragraphs: [
        'If a medicine was too expensive, a routine was difficult to keep, or you could not get a test, say so plainly. Your clinician can only adjust a plan when they know what happened in real life.',
        'If you stopped a medicine or changed how you take it, tell the clinician exactly what you did. This is useful information, not a confession.'
      ] },
      { heading: 'Leave with a clear next step', paragraphs: [
        'Before the appointment ends, ask what happens next and when you should return. Confirm how results will be shared and whom to contact with a question. If there is no follow-up needed, ask what would change that advice.',
        'This is a conversation checklist, not medical advice. Follow the guidance of your treating clinician for your situation.'
      ] }
    ]
  },
  {
    id: 'choosing-a-clinic-near-you',
    title: 'A better way to choose a clinic near you',
    tags: ['Choosing care', 'Costs'],
    excerpt: 'Distance matters, but so do opening hours, accessibility, price clarity, and what happens after your appointment.',
    readingMinutes: 3,
    sections: [
      { heading: 'Check the practical fit', paragraphs: [
        'Start with the details that affect whether you can actually make the visit: travel time at the hour of your appointment, step-free access if needed, parking or transit, and the clinic’s current hours. Call to confirm anything that is essential for you.',
        'Ask whether the clinician you want sees patients at that exact location. A group may have several branches, and a doctor’s profile does not always tell you which one has the next available visit.'
      ] },
      { heading: 'Ask about the whole journey', paragraphs: [
        'Find out how you will receive test results, prescriptions, invoices, and follow-up instructions. If you need a caregiver to join, ask what the clinic permits. If language support matters, check that before booking.',
        'A convenient appointment is less useful if you cannot understand the next step or get a question answered afterward.'
      ] },
      { heading: 'Use reviews carefully', paragraphs: [
        'Reviews can tell you about communication, waiting, and the reception experience. They cannot reliably tell you whether a treatment is right for you. Look for specific patterns, and balance them with verified clinician credentials and clear answers from the clinic.',
        'Before paying, confirm the consultation fee, possible extras, and cancellation terms. The cheapest visible price is not always the total cost.'
      ] }
    ]
  }
];
