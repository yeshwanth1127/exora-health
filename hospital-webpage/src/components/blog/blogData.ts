export interface BlogPost {
  id: string;
  date: string;
  author: string;
  title: string;
  tags: string[];
  excerpt: string;
  sections: {
    heading?: string;
    paragraphs: string[];
  }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 'fragmented-healthcare-problem',
    date: '13 May, 2026',
    author: 'Dr. Vikram Rao, Chief Medical Officer',
    title: 'The Fragmented Healthcare Problem – Why We Built Avocado Health',
    tags: ['Clinical Care', 'Patient Experience'],
    excerpt:
      'Traditional hospital visits rely on rushed 5-minute consultations and fragmented paperwork, but this model compromises health outcomes. Discover how we built an unhurried, continuous care model ...',
    sections: [
      {
        heading: 'The Problem with Traditional Healthcare Systems',
        paragraphs: [
          'Traditional hospital visits rely on rushed 5-minute consultations, endless paperwork, and disconnected departments where doctors rarely have the time to understand your full medical story. Waiting two hours in crowded, stressful waiting rooms only to receive hurried advice would be unacceptable in any other essential service—yet in healthcare, this remains the stressful norm.',
          'Patients often carry thick binders of previous lab reports, handwritten prescriptions, and diagnostic scans from clinic to clinic, hoping their physician has the time to piece the timeline together. A missed detail or overlooked medication conflict shouldn’t compromise patient health. Some assume bureaucracy is simply the inevitable cost of modern medicine, but at Avocado Health, we strongly disagree. With thoughtful clinical design, thorough diagnostic attention and a warm, dignified experience can go hand in hand.',
          'Large corporate hospital chains have scaled bed capacities, but they often sacrifice physician empathy and diagnostic thoroughness. We set out to build a clinical network that is deeply human, unhurried, and technologically seamless—not just in promotional brochures, but across every single consultation and bedside interaction.'
        ]
      },
      {
        heading: 'A Modern Approach to Continuous Family Wellness',
        paragraphs: [
          'With Avocado Health, every individual and family is paired with a dedicated primary care physician supported by top-tier organ specialists. Our unified electronic health record securely tracks your biometrics, lab trends, and medications over time, empowering your care team to spot subtle clinical shifts long before they become acute emergencies.',
          'Our vision is a healthcare sanctuary where seeking medical care feels as seamless, reassuring, and dignified as visiting a trusted family doctor who truly knows your story.'
        ]
      }
    ]
  },
  {
    id: 'simpler-safer',
    date: '2 April, 2026',
    author: 'Dr. Ananya Sen, Head of Preventive Medicine',
    title: 'Making Diagnostic Checkups Simpler, Faster & Stress-Free',
    tags: ['Preventive Health', 'Diagnostics'],
    excerpt:
      "We're thrilled to introduce our upgraded comprehensive diagnostic suite—designed to make routine screenings, cardiovascular imaging, and blood biomarkers completely anxiety-free ...",
    sections: [
      {
        heading: 'Reimagining Preventive Clinical Screenings',
        paragraphs: [
          "We're thrilled to introduce our upgraded comprehensive diagnostic suite—designed to make routine screenings, cardiovascular imaging, and blood biomarkers completely anxiety-free. Born from our conviction that early detection saves lives, this initiative eliminates fasting queues, ensures gentle zero-pain sample collections, and delivers verified digital pathology reports within hours.",
          'Every diagnostic parameter is explained in plain English by your consulting physician, transforming confusing numerical reference ranges into clear, actionable health milestones.'
        ]
      },
      {
        heading: 'Continuous Care Beyond the Clinic Walls',
        paragraphs: [
          'Preventive medicine shouldn’t end when you walk out of the clinic doors. With integrated digital home monitoring, patients with hypertension or metabolic risks receive automated check-ins and personalized dietary adjustments.',
          'Coupled with round-the-clock WhatsApp access to our duty medical officers, families enjoy complete peace of mind knowing qualified medical guidance is always one touch away.'
        ]
      }
    ]
  }
];
