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
  {
    "id": "getting-started",
    "title": "Getting Started with Sri Lakshmi Hospital",
    "category": "General"
  },
  {
    "id": "send-receive",
    "title": "Send, Receive & Book Consultations",
    "category": "Appointments"
  },
  {
    "id": "activity-records",
    "title": "Activity & Health Records",
    "category": "Medical Records"
  },
  {
    "id": "emergency-protocols",
    "title": "Emergency Care & Ambulance Protocols",
    "category": "Emergency"
  },
  {
    "id": "insurance-billing",
    "title": "Cashless Insurance & TPA Claims",
    "category": "Billing"
  },
  {
    "id": "miscellaneous",
    "title": "Miscellaneous Hospital Policies",
    "category": "General"
  }
];
export const LEGAL_CATEGORIES: LegalCategory[] = [
  {
    "id": "care",
    "title": "Patient Care & Services",
    "description": "Policy content awaiting hospital confirmation.",
    "documents": [
      {
        "id": "terms",
        "title": "Terms of Service",
        "lastUpdated": "Demo draft",
        "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
      },
      {
        "id": "privacy",
        "title": "Privacy Notice",
        "lastUpdated": "Demo draft",
        "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
      }
    ]
  },
  {
    "id": "telehealth",
    "title": "Clinical Consent & Telehealth",
    "description": "Policy content awaiting hospital confirmation.",
    "documents": [
      {
        "id": "telehealth",
        "title": "Teleconsultation Consent Agreement",
        "lastUpdated": "Demo draft",
        "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
      },
      {
        "id": "records",
        "title": "Health Data & ABHA Policy",
        "lastUpdated": "Demo draft",
        "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
      }
    ]
  },
  {
    "id": "billing",
    "title": "Hospital Billing & Insurance",
    "description": "Policy content awaiting hospital confirmation.",
    "documents": [
      {
        "id": "billing",
        "title": "Cashless Insurance & Hospital Billing Guidelines",
        "lastUpdated": "Demo draft",
        "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
      },
      {
        "id": "refund",
        "title": "Cancellation & Refund Policy",
        "lastUpdated": "Demo draft",
        "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
      }
    ]
  }
];
export const ALL_LEGAL_DOCS: Record<string, LegalDocument> = {
  "terms": {
    "id": "terms",
    "title": "Terms of Service",
    "lastUpdated": "Demo draft — 3 October 2026",
    "category": "Patient Care & Services",
    "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy.",
    "emergencyNotice": "NOTICE ON PROHIBITED USE – RESTRICTED MEDICAL CONDITIONS: THE SERVICES ARE NOT OFFERED TO AND MAY NOT BE USED BY PERSONS IN IMMEDIATE LIFE-THREATENING CRITICAL CARE CRISES. THE DIGITAL APPS AND TELECONSULTATION PORTALS ARE NOT DESIGNED FOR RESUSCITATION. IN THE EVENT OF ACUTE CHEST PAIN, SEVERE TRAUMA, RESPIRATORY ARREST, ACUTE STROKE, OR UNCONTROLLED BLEEDING, YOU MUST IMMEDIATELY DIAL SRI LAKSHMI EMERGENCY HELPLINE (99017 11716) OR DISPATCH AN AMBULANCE TO THE NEAREST HOSPITAL CASUALTY WARD.",
    "introParagraphs": [
      "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
    ],
    "sections": [
      {
        "id": "agreement-to-terms",
        "title": "Agreement to Terms",
        "shortTitle": "Agreement to Terms.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "privacy-policy",
        "title": "Privacy Policy",
        "shortTitle": "Privacy Policy.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "changes-to-terms",
        "title": "Changes to these Terms or the Services",
        "shortTitle": "Changes to these Terms or the Services.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "who-can-use",
        "title": "Who can use of the Services",
        "shortTitle": "Who can use of the Services.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "use-of-services",
        "title": "Use of the Services",
        "shortTitle": "Use of the Services.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ],
        "subsections": [
          {
            "subtitle": "Account Creation Process",
            "text": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
          },
          {
            "subtitle": "Identity Verification",
            "text": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
          },
          {
            "subtitle": "Privacy Protection",
            "text": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
          },
          {
            "subtitle": "Authentication Setup",
            "text": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
          },
          {
            "subtitle": "Recovery Assurance",
            "text": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
          }
        ]
      },
      {
        "id": "assumption-of-risk",
        "title": "Assumption of Risk",
        "shortTitle": "Assumption of Risk.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "feedback",
        "title": "Feedback",
        "shortTitle": "Feedback.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "fees",
        "title": "Fees",
        "shortTitle": "Fees.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "third-party-resources",
        "title": "Third-Party Resources and Services",
        "shortTitle": "Third-Party Resources and Services.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "rights-terms-apps",
        "title": "Rights and Terms for Apps",
        "shortTitle": "Rights and Terms for Apps.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "general-prohibitions",
        "title": "General Prohibitions and the Hospital's Enforcement Rights",
        "shortTitle": "General Prohibitions and the Company’s Enforcement Rights.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "suspension-termination",
        "title": "Suspension and Termination",
        "shortTitle": "Suspension and Termination.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "warranty-disclaimers",
        "title": "Warranty Disclaimers",
        "shortTitle": "Warranty Disclaimers.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "indemnity",
        "title": "Indemnity",
        "shortTitle": "Indemnity.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "limitation-of-liability",
        "title": "Limitation of Liability",
        "shortTitle": "Limitation of Liability.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "governing-law",
        "title": "Governing Law and Forum Choice",
        "shortTitle": "Governing Law and Forum Choice.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "dispute-resolution",
        "title": "Dispute Resolution",
        "shortTitle": "Dispute Resolution.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "general-terms",
        "title": "General Terms",
        "shortTitle": "General Terms.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "contact-information",
        "title": "Contact Information",
        "shortTitle": "Contact Information.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      }
    ]
  },
  "privacy": {
    "id": "privacy",
    "title": "Patient Privacy Notice & DPDP Compliance",
    "lastUpdated": "Demo draft — 3 October 2026",
    "category": "Clinical Care & Patient Services",
    "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy.",
    "introParagraphs": [
      "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
    ],
    "sections": [
      {
        "id": "data-collection",
        "title": "1. Categories of Health & Personal Data Collected",
        "shortTitle": "Data Collected.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "data-usage",
        "title": "2. Purpose & Clinical Justification of Processing",
        "shortTitle": "Purpose of Processing.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "data-encryption",
        "title": "3. Technical Security & Encryption Architecture",
        "shortTitle": "Encryption & Security.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "patient-rights",
        "title": "4. Patient Sovereignty & Data Portability Rights",
        "shortTitle": "Patient Rights.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "privacy-contact",
        "title": "5. Data Protection Officer & Grievance Contact",
        "shortTitle": "Contact Officer.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      }
    ]
  },
  "telehealth": {
    "id": "telehealth",
    "title": "Teleconsultation & Informed Consent Agreement",
    "lastUpdated": "Demo draft — 3 October 2026",
    "category": "Clinical Consent & Telehealth Protocols",
    "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy.",
    "emergencyNotice": "TELECONSULTATION IS NOT FOR EMERGENCIES: Virtual consultations cannot replace emergency resuscitation. For acute trauma, chest pain, or stroke, call 99017 11716 or proceed to hospital emergency casualty immediately.",
    "introParagraphs": [
      "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
    ],
    "sections": [
      {
        "id": "telehealth-scope",
        "title": "1. Clinical Scope & Statutory Boundaries",
        "shortTitle": "Scope & Boundaries.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "prescribing-limits",
        "title": "2. Statutory Limits on Telemedicine Prescriptions",
        "shortTitle": "Prescription Limits.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "telehealth-consent",
        "title": "3. Informed Patient Consent",
        "shortTitle": "Patient Consent.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      }
    ]
  },
  "records": {
    "id": "records",
    "title": "Health Data, ABHA & Medical Records Policy",
    "lastUpdated": "Demo draft — 3 October 2026",
    "category": "Clinical Consent & Telehealth Protocols",
    "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy.",
    "introParagraphs": [
      "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
    ],
    "sections": [
      {
        "id": "abha-creation",
        "title": "1. ABHA Generation & Linking Protocol",
        "shortTitle": "ABHA Linking.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "record-retention",
        "title": "2. Clinical Record Retention Periods",
        "shortTitle": "Record Retention.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      }
    ]
  },
  "billing": {
    "id": "billing",
    "title": "Cashless Insurance & Hospital Billing Guidelines",
    "lastUpdated": "Demo draft — 3 October 2026",
    "category": "Hospital Billing & Insurance Guidelines",
    "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy.",
    "introParagraphs": [
      "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
    ],
    "sections": [
      {
        "id": "empanelled-tpa",
        "title": "1. Empanelled Insurance Networks & TPA Desk",
        "shortTitle": "Empanelled TPAs.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "non-payable-expenses",
        "title": "2. Non-Medical Exclusions & Patient Share",
        "shortTitle": "Non-Medical Deductions.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      }
    ]
  },
  "refund": {
    "id": "refund",
    "title": "Appointment Cancellation & Fee Refund Policy",
    "lastUpdated": "Demo draft — 3 October 2026",
    "category": "Hospital Billing & Insurance Guidelines",
    "summary": "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy.",
    "introParagraphs": [
      "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
    ],
    "sections": [
      {
        "id": "refund-timelines",
        "title": "1. Cancellation Windows & Refund Percentages",
        "shortTitle": "Refund Windows.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      },
      {
        "id": "hospital-cancellations",
        "title": "2. Hospital Initiated Rescheduling",
        "shortTitle": "Doctor Rescheduling.",
        "content": [
          "Hospital-approved policy text was not provided on the public website. This page is a content placeholder for the client demo; contact the hospital for its current policy."
        ]
      }
    ]
  }
};

export const TERMS_OF_SERVICE_DOC = ALL_LEGAL_DOCS.terms;
