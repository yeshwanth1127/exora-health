export interface LegalSection {
  id: string;
  title: string;
  shortTitle?: string;
  content: string[];
  subsections?: {
    subtitle: string;
    badge?: string;
    text: string;
    bulletPoints?: string[];
  }[];
}

export interface LegalDocument {
  id: string;
  title: string;
  lastUpdated: string;
  category: string;
  summary: string;
  emergencyNotice?: string;
  introParagraphs: string[];
  sections: LegalSection[];
}

export interface LegalCategory {
  id: string;
  title: string;
  description: string;
  documents: {
    id: string;
    title: string;
    lastUpdated: string;
    summary: string;
  }[];
}

export interface SupportArticle {
  id: string;
  title: string;
  actionUrl?: string;
  category: string;
}

export const LEGAL_SUPPORT_ARTICLES: SupportArticle[] = [
  { id: 'getting-started', title: 'Getting Started with Avocado Health', category: 'General' },
  { id: 'send-receive', title: 'Send, Receive & Book Consultations', category: 'Appointments' },
  { id: 'activity-records', title: 'Activity & Health Records', category: 'Medical Records' },
  { id: 'emergency-protocols', title: 'Emergency Care & Ambulance Protocols', category: 'Emergency' },
  { id: 'insurance-billing', title: 'Cashless Insurance & TPA Claims', category: 'Billing' },
  { id: 'miscellaneous', title: 'Miscellaneous Hospital Policies', category: 'General' },
];

export const LEGAL_CATEGORIES: LegalCategory[] = [
  {
    id: 'care',
    title: 'Patient Care & Services',
    description: 'Core legal agreements governing hospital visits, patient rights, electronic portal access, and general terms of healthcare service.',
    documents: [
      {
        id: 'terms',
        title: 'Terms of Service',
        lastUpdated: '21 May 2025',
        summary: 'Standard terms governing all in-person consultations, clinical procedures, teleconsultation services, and Avocado Patient Portal use.',
      },
      {
        id: 'privacy',
        title: 'Privacy Notice',
        lastUpdated: '22 May 2025',
        summary: 'How Avocado Health collects, encrypts, and protects your confidential medical histories, diagnostic tests, and personal health data under Indian healthcare regulations.',
      },
    ],
  },
  {
    id: 'telehealth',
    title: 'Clinical Consent & Telehealth',
    description: 'Informed consent frameworks, digital teleconsultation boundaries, and electronic medical records policies.',
    documents: [
      {
        id: 'telehealth',
        title: 'Teleconsultation Consent Agreement',
        lastUpdated: '22 Oct 2024',
        summary: 'Informed consent criteria, statutory physician video consultation boundaries under National Medical Commission guidelines, and emergency referral disclaimers.',
      },
      {
        id: 'records',
        title: 'Health Data & ABHA Policy',
        lastUpdated: '22 Oct 2024',
        summary: 'Ayushman Bharat Digital Mission (ABDM) integration, 14-digit ABHA creation, electronic health record retention, and patient data portability rights.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Hospital Billing & Insurance',
    description: 'Clear financial protocols regarding health packages, insurance desk pre-authorizations, cancellation fees, and refund turnaround times.',
    documents: [
      {
        id: 'billing',
        title: 'Cashless Insurance & Hospital Billing Guidelines',
        lastUpdated: '15 Jan 2025',
        summary: 'Empanelled TPA network guidelines, pre-authorization documentation, room tariff breakdowns, and transparent package pricing policies.',
      },
      {
        id: 'refund',
        title: 'Cancellation & Refund Policy',
        lastUpdated: '10 Aug 2024',
        summary: 'Guidelines for rescheduling doctor slots, diagnostic home sample pickup cancellations, and processing windows for electronic refund remittances.',
      },
    ],
  },
];

export const TERMS_OF_SERVICE_DOC: LegalDocument = {
  id: 'terms',
  title: 'Terms of Service',
  lastUpdated: 'May 21, 2025',
  category: 'Patient Care & Services',
  summary: 'Comprehensive terms governing clinical consultations, diagnostic packages, teleconsultations, and digital patient accounts at Avocado Health.',
  emergencyNotice: 'NOTICE ON PROHIBITED USE – RESTRICTED MEDICAL CONDITIONS: THE SERVICES ARE NOT OFFERED TO AND MAY NOT BE USED BY PERSONS IN IMMEDIATE LIFE-THREATENING CRITICAL CARE CRISES. THE DIGITAL APPS AND TELECONSULTATION PORTALS ARE NOT DESIGNED FOR RESUSCITATION. IN THE EVENT OF ACUTE CHEST PAIN, SEVERE TRAUMA, RESPIRATORY ARREST, ACUTE STROKE, OR UNCONTROLLED BLEEDING, YOU MUST IMMEDIATELY DIAL AVOCADO EMERGENCY HELPLINE (080 4968 2800) OR DISPATCH AN AMBULANCE TO THE NEAREST HOSPITAL CASUALTY WARD.',
  introParagraphs: [
    'Avocado Health Clinics Ltd ("Company", "Hospital", "we", "us") provides NABH-accredited multi-specialty clinical centers, outpatient surgical suites, diagnostic laboratories, and digital patient portal software to help patients coordinate medical care, schedule consultations with registered doctors, access digitized diagnostic reports, and manage protected health information (the "Portal").',
    'The Portal is designed to enable patients to (i) schedule in-person and video consultations; (ii) securely access computerized blood test panels, imaging records, and electronic prescriptions; (iii) facilitate encrypted communication with attending clinicians; and (iv) utilize health checkup packages and cashless hospital admission workflows. Please read these Terms of Service (the "Terms") and our Privacy Policy carefully because they govern your use of the Portal and corresponding mobile and web application interfaces (together, the "Services").',
  ],
  sections: [
    {
      id: 'agreement-to-terms',
      title: 'Agreement to Terms',
      shortTitle: 'Agreement to Terms.',
      content: [
        'By using our Services, you agree to be bound by these Terms. If you don\'t agree to be bound by these Terms, do not use the Services. If you are accessing the Services on behalf of another individual (such as an elderly parent, minor dependent, or person under legal guardianship), you represent and warrant that you have the authority to bind that individual to these Terms.',
      ],
    },
    {
      id: 'privacy-policy',
      title: 'Privacy Policy',
      shortTitle: 'Privacy Policy.',
      content: [
        'Please review our Privacy Policy, which also governs your use of the Services, for information on how we collect, use, encrypt, and share your personal and medical information in accordance with India\'s Digital Personal Data Protection (DPDP) Act 2023 and the Information Technology Act 2000.',
      ],
    },
    {
      id: 'changes-to-terms',
      title: 'Changes to these Terms or the Services',
      shortTitle: 'Changes to these Terms or the Services.',
      content: [
        'We may update the Terms at any time in our sole discretion. If we do so, we\'ll let you know by posting the updated Terms on the Site, through the App, or through other communications. It\'s important that you review the Terms whenever we update them or you use the Services.',
        'If you continue to use the Services after we have posted updated Terms, you agree to be bound by the modified Terms. If you don\'t agree to be bound by the modified Terms, then you may no longer use the Services.',
      ],
    },
    {
      id: 'who-can-use',
      title: 'Who can use of the Services',
      shortTitle: 'Who can use of the Services.',
      content: [
        'You may use the Services only if you are 18 years or older and capable of forming a binding contract with Avocado Health Clinics Ltd, and not otherwise barred from using the Services under applicable law.',
        'Minors under 18 years of age may receive medical care and book appointments only under the direct supervision and legal consent of a parent or lawful guardian.',
      ],
    },
    {
      id: 'use-of-services',
      title: 'Use of the Services',
      shortTitle: 'Use of the Services.',
      content: [
        'Avocado Health provides an integrated digital care platform allowing verified patients to book appointments, review laboratory results, obtain digital prescriptions, and teleconsult with registered medical practitioners (RMPs).',
        'In addition to the standard booking portal, Avocado Patient Accounts can also optionally be integrated as a standalone authentication option outside of the clinic portal via the hospital API. Read the documentation to learn more.',
      ],
      subsections: [
        {
          subtitle: 'Account Creation Process',
          text: 'The process begins when patients enter an Indian mobile phone number or verified email address and verify ownership via a one-time code (OTP). This step ensures that patients can prove ownership before encrypted health records or clinical appointment histories are shared.',
        },
        {
          subtitle: 'Identity Verification',
          text: 'The process begins when users enter an email or phone number and verify ownership via a one-time code. This step ensures that users can prove ownership before encrypted keys or medical files are shared.',
        },
        {
          subtitle: 'Privacy Protection',
          text: 'While verification codes are sent through telecom gateways, raw patient credentials and identification details are salted and hashed in our database, preserving privacy while supporting secure clinical synchronization.',
        },
        {
          subtitle: 'Authentication Setup',
          text: 'When accessing Avocado Accounts via the web, users must set a password. For iOS and Android users, there is an option to use passkey-only authentication instead. However, since passkeys work within device ecosystems and credentials may be lost if you switch browsers or devices, a strong fallback password is still recommended for web access.',
        },
        {
          subtitle: 'Recovery Assurance',
          text: 'Even if both the password and passkey are lost, clinical identity verification at any physical Avocado clinic admission counter across Bengaluru will safely restore complete account access.',
        },
      ],
    },
    {
      id: 'assumption-of-risk',
      title: 'Assumption of Risk',
      shortTitle: 'Assumption of Risk.',
      content: [
        'Medical procedures, outpatient screenings, and pharmacological prescriptions inherently carry clinical variability and physiological risks. While Avocado Health clinicians adhere to NABH-accredited treatment protocols, clinical medicine cannot guarantee identical health outcomes for all patients.',
        'You understand and acknowledge that telemedicine consultations rely on audiovisual communication technologies. If audio or video transmission quality is compromised, the attending doctor reserves the clinical obligation to order an in-person physical examination.',
      ],
    },
    {
      id: 'feedback',
      title: 'Feedback',
      shortTitle: 'Feedback.',
      content: [
        'We welcome feedback, comments, clinical service reviews, and suggestions for improvements to the Services ("Feedback"). You can submit Feedback by emailing compliance@avocadohealth.in or through the in-app patient feedback portal.',
        'You grant to us a non-exclusive, transferable, worldwide, perpetual, irrevocable, fully-paid, royalty-free license to use, copy, modify, create derivative works based upon, and otherwise exploit the Feedback for any clinical, quality assurance, or platform improvement purpose.',
      ],
    },
    {
      id: 'fees',
      title: 'Fees',
      shortTitle: 'Fees.',
      content: [
        'Consultation tariffs, lab test rates, and preventive health packages are published transparently in Indian Rupees (INR). Payment is processed securely at the time of appointment booking or clinical triage.',
        'Avocado Health maintains an absolute zero-hidden-fee policy. Standard specialist consultation fees include the initial evaluation and a complimentary follow-up consultation within 7 calendar days.',
      ],
    },
    {
      id: 'third-party-resources',
      title: 'Third-Party Resources and Services',
      shortTitle: 'Third-Party Resources and Services.',
      content: [
        'The Services may contain links to third-party healthcare resources, Third-Party Administrators (TPAs), cashless health insurance networks, or accredited reference pathology laboratories. We provide these links solely as a convenience to our patients.',
        'We do not control and are not responsible for the content, privacy policies, or claims adjudication practices of such external insurers or TPAs.',
      ],
    },
    {
      id: 'rights-terms-apps',
      title: 'Rights and Terms for Apps',
      shortTitle: 'Rights and Terms for Apps.',
      content: [
        'Subject to your compliance with these Terms, Avocado Health grants you a limited non-exclusive, non-transferable, non-sublicensable license to download and install a copy of the App on a mobile device that you own or control and to run such copy of the App solely for your own personal, non-commercial healthcare management.',
      ],
    },
    {
      id: 'general-prohibitions',
      title: 'General Prohibitions and the Hospital\'s Enforcement Rights',
      shortTitle: 'General Prohibitions and the Company’s Enforcement Rights.',
      content: [
        'You agree not to: (a) post or transmit defamatory, abusive, or unlawful content; (b) attempt to access another patient\'s medical records or diagnostic reports; (c) reverse engineer or disrupt the patient portal infrastructure; or (d) record audio or video of clinical consultations without the explicit prior written authorization of the physician.',
        'Avocado Health strictly enforces a Zero Tolerance workplace violence policy protecting clinical staff across all our hospital locations in Bengaluru.',
      ],
    },
    {
      id: 'suspension-termination',
      title: 'Suspension and Termination',
      shortTitle: 'Suspension and Termination.',
      content: [
        'We may suspend or terminate your access to and use of the Services, including suspending access to or closing your patient portal account, at our sole discretion, at any time and without notice to you, if you breach these Terms or engage in fraudulent clinical conduct.',
        'Upon termination, you may request an export of your longitudinal medical history by visiting the medical records department at our primary clinic center in Indiranagar.',
      ],
    },
    {
      id: 'warranty-disclaimers',
      title: 'Warranty Disclaimers',
      shortTitle: 'Warranty Disclaimers.',
      content: [
        'THE SERVICES AND HEALTHCARE INFORMATION ARE PROVIDED "AS IS," WITHOUT WARRANTY OF ANY KIND. WITHOUT LIMITING THE FOREGOING, WE EXPLICITLY DISCLAIM ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR MEDICAL PURPOSE, QUIET ENJOYMENT, AND NON-INFRINGEMENT.',
        'We make no warranty that the Services will meet your diagnostic requirements or be available on an uninterrupted, secure, or error-free basis.',
      ],
    },
    {
      id: 'indemnity',
      title: 'Indemnity',
      shortTitle: 'Indemnity.',
      content: [
        'You will indemnify and hold harmless Avocado Health Clinics Ltd and its officers, directors, licensed physicians, nurses, and agents, from and against any claims, disputes, demands, liabilities, damages, losses, and costs and expenses, including reasonable legal and accounting fees arising out of or in any way connected with your violation of these Terms or intentional concealment of medical history.',
      ],
    },
    {
      id: 'limitation-of-liability',
      title: 'Limitation of Liability',
      shortTitle: 'Limitation of Liability.',
      content: [
        'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, NEITHER AVOCADO HEALTH NOR ANY OTHER PARTY INVOLVED IN CREATING, PRODUCING, OR DELIVERING THE SERVICES WILL BE LIABLE FOR ANY INCIDENTAL, SPECIAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES ARISING OUT OF OR IN CONNECTION WITH THESE TERMS.',
        'Nothing in these Terms limits or excludes liability for proven gross negligence or intentional medical malpractice in violation of the National Medical Commission regulations or the Consumer Protection Act 2019.',
      ],
    },
    {
      id: 'governing-law',
      title: 'Governing Law and Forum Choice',
      shortTitle: 'Governing Law and Forum Choice.',
      content: [
        'These Terms and any action related thereto will be governed by the laws of India, without regard to its conflict of laws provisions.',
        'The exclusive jurisdiction for all Disputes that you and Avocado Health are not required to arbitrate will be the state and commercial courts located in Bengaluru, Karnataka, India.',
      ],
    },
    {
      id: 'dispute-resolution',
      title: 'Dispute Resolution',
      shortTitle: 'Dispute Resolution.',
      content: [
        'Prior to initiating arbitration or court proceedings, you and Avocado Health agree to attempt to resolve any dispute, claim, or grievance informally by contacting our Patient Grievance Redressal Officer.',
        'Any unresolved clinical dispute arising out of or in connection with this agreement shall be referred to and finally resolved by sole arbitration in Bengaluru in accordance with the Arbitration and Conciliation Act 1996.',
      ],
    },
    {
      id: 'general-terms',
      title: 'General Terms',
      shortTitle: 'General Terms.',
      content: [
        'These Terms constitute the entire and exclusive understanding and agreement between Avocado Health and you regarding the Services, and supersede and replace all prior oral or written understandings between Avocado Health and you.',
        'If any provision of these Terms is held invalid or unenforceable by an arbitrator or court of competent jurisdiction, that provision will be enforced to the maximum extent permissible and the other provisions of these Terms will remain in full force and effect.',
      ],
    },
    {
      id: 'contact-information',
      title: 'Contact Information',
      shortTitle: 'Contact Information.',
      content: [
        'If you have any questions about these Terms or the Services, please contact Avocado Health at:',
        'Avocado Health Clinics Private Limited\nLegal, Compliance & Medical Records Desk\n100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038\n24/7 Telephone: 080 4968 2800\nEmail: compliance@avocadohealth.in\nMedical Director: Dr. V. Sundaram, MD',
      ],
    },
  ],
};

export const ALL_LEGAL_DOCS: Record<string, LegalDocument> = {
  terms: TERMS_OF_SERVICE_DOC,
  privacy: {
    id: 'privacy',
    title: 'Patient Privacy Notice & DPDP Compliance',
    lastUpdated: 'May 22, 2025',
    category: 'Clinical Care & Patient Services',
    summary: 'Comprehensive details on how patient health records, diagnostic tests, and personal identifiers are collected, encrypted, and governed.',
    introParagraphs: [
      'Avocado Health Clinics Private Limited ("Avocado Health", "we", "our") is dedicated to upholding the highest standards of data confidentiality, clinical discretion, and digital security. This Privacy Notice details how we gather, process, store, and safeguard your sensitive personal data and protected health information (PHI).',
      'In strict adherence with India\'s Digital Personal Data Protection (DPDP) Act 2023, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, and National Digital Health Mission standards, we ensure that you retain full sovereignty over your clinical records.',
    ],
    sections: [
      {
        id: 'data-collection',
        title: '1. Categories of Health & Personal Data Collected',
        shortTitle: 'Data Collected.',
        content: [
          'We collect information necessary to deliver comprehensive clinical care, diagnose medical conditions, dispense pharmaceutical orders, and coordinate emergency responses. This includes: (a) demographic data (name, age, gender, emergency contact); (b) clinical histories, chief complaints, symptoms, allergies, and surgical records; (c) diagnostic laboratory reports, pathology specimens, and radiology scans; and (d) financial and insurance identifiers.',
        ],
      },
      {
        id: 'data-usage',
        title: '2. Purpose & Clinical Justification of Processing',
        shortTitle: 'Purpose of Processing.',
        content: [
          'Your medical records are processed exclusively for: (a) clinical diagnosis, treatment formulation, and surgical planning; (b) dispensing electronic prescriptions and verifying medication interactions; (c) communicating lab test results and critical alert values; (d) adjudicating cashless insurance pre-authorizations; and (e) complying with statutory public health reporting mandates.',
        ],
      },
      {
        id: 'data-encryption',
        title: '3. Technical Security & Encryption Architecture',
        shortTitle: 'Encryption & Security.',
        content: [
          'All patient data in transit is encrypted using TLS 1.3 cryptographic protocols. Stored electronic health records (EHR) in our cloud infrastructure are secured with AES-256 military-grade encryption keys managed via dedicated Hardware Security Modules (HSM). Access to medical dossiers is restricted strictly to licensed clinicians actively assigned to your care.',
        ],
      },
      {
        id: 'patient-rights',
        title: '4. Patient Sovereignty & Data Portability Rights',
        shortTitle: 'Patient Rights.',
        content: [
          'Under the DPDP Act 2023, you hold the right to: (a) access and download a full digital copy of your longitudinal medical history; (b) request correction of inaccurate demographic or historical data; (c) revoke electronic consent for non-essential digital processing; and (d) request transfer of your health summary to external clinical facilities.',
        ],
      },
      {
        id: 'privacy-contact',
        title: '5. Data Protection Officer & Grievance Contact',
        shortTitle: 'Contact Officer.',
        content: [
          'Inquiries regarding health data privacy may be directed to our designated Data Protection Officer:\nEmail: privacy@avocadohealth.in | Phone: 080 4968 2800\nAttn: Chief Information Security Officer, Avocado Health, Indiranagar, Bengaluru 560038.',
        ],
      },
    ],
  },
  telehealth: {
    id: 'telehealth',
    title: 'Teleconsultation & Informed Consent Agreement',
    lastUpdated: 'October 22, 2024',
    category: 'Clinical Consent & Telehealth Protocols',
    summary: 'Guidelines, boundaries, and patient informed consent requirements for digital video and voice teleconsultations.',
    emergencyNotice: 'TELECONSULTATION IS NOT FOR EMERGENCIES: Virtual consultations cannot replace emergency resuscitation. For acute trauma, chest pain, or stroke, call 080 4968 2800 or proceed to hospital emergency casualty immediately.',
    introParagraphs: [
      'This Informed Consent Agreement outlines the clinical boundaries, technological protocols, and mutual responsibilities associated with receiving remote telemedicine services from Avocado Health registered medical practitioners.',
      'By initiating an online consultation, video appointment, or virtual chat session, you certify that you understand the operational nature and intrinsic limitations of digital telemedicine compared with in-person physical examinations.',
    ],
    sections: [
      {
        id: 'telehealth-scope',
        title: '1. Clinical Scope & Statutory Boundaries',
        shortTitle: 'Scope & Boundaries.',
        content: [
          'Teleconsultations are conducted in strict compliance with the Telemedicine Practice Guidelines issued under the National Medical Commission Act 2019. Virtual visits are suited for preliminary symptom triage, routine follow-up reviews, non-urgent prescription refills, chronic disease tracking, and second opinion consultations.',
        ],
      },
      {
        id: 'prescribing-limits',
        title: '2. Statutory Limits on Telemedicine Prescriptions',
        shortTitle: 'Prescription Limits.',
        content: [
          'In accordance with Indian drug schedules, our physicians CANNOT prescribe Schedule X controlled substances, psychotropic agents, sedatives, or injectable medications over virtual teleconsultations. When clinical prudence dictates that physical auscultation or palpation is necessary, the doctor will mandate an in-person clinical examination.',
        ],
      },
      {
        id: 'telehealth-consent',
        title: '3. Informed Patient Consent',
        shortTitle: 'Patient Consent.',
        content: [
          'You acknowledge that you retain the absolute right to discontinue a teleconsultation at any stage and seek physical hospital care. You also understand that remote diagnoses are predicated on the accuracy of clinical history and photos/scans provided by you.',
        ],
      },
    ],
  },
  records: {
    id: 'records',
    title: 'Health Data, ABHA & Medical Records Policy',
    lastUpdated: 'October 22, 2024',
    category: 'Clinical Consent & Telehealth Protocols',
    summary: 'Integration with Ayushman Bharat Digital Mission (ABDM), ABHA creation, and electronic health record retention standards.',
    introParagraphs: [
      'Avocado Health is an authorized Health Information Provider (HIP) and Health Information User (HIU) under the Ayushman Bharat Digital Mission (ABDM) framework instituted by the National Health Authority (NHA), Government of India.',
      'This policy details how your 14-digit Ayushman Bharat Health Account (ABHA) connects your hospital medical encounters into an interoperable, unified national health record ecosystem.',
    ],
    sections: [
      {
        id: 'abha-creation',
        title: '1. ABHA Generation & Linking Protocol',
        shortTitle: 'ABHA Linking.',
        content: [
          'We assist patients in generating or linking their 14-digit ABHA address using Aadhaar-based or Mobile OTP authentication. Linking your ABHA enables seamless synchronization of discharge summaries, lab test results, and vaccination certifications across accredited Indian hospitals.',
        ],
      },
      {
        id: 'record-retention',
        title: '2. Clinical Record Retention Periods',
        shortTitle: 'Record Retention.',
        content: [
          'In compliance with Medical Council of India guidelines, Avocado Health retains in-patient medical records, operative notes, and anesthetic charts for a statutory minimum of three (3) years from the date of discharge. Pediatric records are retained until the patient attains twenty-one (21) years of age.',
        ],
      },
    ],
  },
  billing: {
    id: 'billing',
    title: 'Cashless Insurance & Hospital Billing Guidelines',
    lastUpdated: 'January 15, 2025',
    category: 'Hospital Billing & Insurance Guidelines',
    summary: 'Guidelines for cashless insurance pre-authorizations, empanelled TPAs, room tariffs, and non-medical billing exclusions.',
    introParagraphs: [
      'Avocado Health believes in radical financial transparency for clinical care. These guidelines detail how hospital estimates, insurance pre-authorizations, and day-care packages are processed.',
    ],
    sections: [
      {
        id: 'empanelled-tpa',
        title: '1. Empanelled Insurance Networks & TPA Desk',
        shortTitle: 'Empanelled TPAs.',
        content: [
          'Our 24/7 Insurance Desk coordinates cashless approvals with over 28 leading health insurance providers and TPAs in India, including Star Health, HDFC ERGO, Care Health, ICICI Lombard, Niva Bupa, and Paramount TPA.',
        ],
      },
      {
        id: 'non-payable-expenses',
        title: '2. Non-Medical Exclusions & Patient Share',
        shortTitle: 'Non-Medical Deductions.',
        content: [
          'Standard IRDAI guidelines classify certain consumable hospital items (e.g. PPE kits, sanitization packs, admission kits, thermometers) as non-payable. Patients are briefed on anticipated non-medical deductions prior to elective admission.',
        ],
      },
    ],
  },
  refund: {
    id: 'refund',
    title: 'Appointment Cancellation & Fee Refund Policy',
    lastUpdated: 'August 10, 2024',
    category: 'Hospital Billing & Insurance Guidelines',
    summary: 'Turnaround times, cancellation fee structures, and electronic remittance terms for outpatient and diagnostic bookings.',
    introParagraphs: [
      'This policy governs financial cancellations and refund turnaround timelines for clinical consultations, home diagnostic sample pick-ups, and preventative health checks at Avocado Health.',
    ],
    sections: [
      {
        id: 'refund-timelines',
        title: '1. Cancellation Windows & Refund Percentages',
        shortTitle: 'Refund Windows.',
        content: [
          'Appointments cancelled at least 2 hours prior to the booked time slot receive a 100% full refund with zero cancellation penalty. Electronic refunds are dispatched immediately and credit to the original payment source within 3-5 business banking days under RBI NEFT/UPI settlement cycles.',
        ],
      },
      {
        id: 'hospital-cancellations',
        title: '2. Hospital Initiated Rescheduling',
        shortTitle: 'Doctor Rescheduling.',
        content: [
          'If a physician is called away for emergency surgery, patients are given the option of priority immediate rescheduling with another senior consultant or an instant 100% refund with a complimentary health voucher.',
        ],
      },
    ],
  },
};
