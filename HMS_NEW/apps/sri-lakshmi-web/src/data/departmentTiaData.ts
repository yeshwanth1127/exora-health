
export interface TiaServiceItem {
  category: string;
  title: string;
  description: string;
}

export interface TiaSymptomSlide {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

export interface TiaPillarItem {
  title: string;
  description: string;
}

export interface TiaArticleItem {
  tag: string;
  title: string;
  snippet: string;
}

export interface DepartmentTiaContent {
  hero: {
    title: string;
    bullets: string[];
    image: string;
    imageAlt: string;
  };
  services: {
    heading: string;
    items: TiaServiceItem[];
  };
  symptoms: {
    heading: string;
    slides: TiaSymptomSlide[];
  };
  whyMatters: {
    heading: string;
    pillars: TiaPillarItem[];
  };
  cta: {
    heading: string;
    description: string;
  };
  resources: {
    heading: string;
    articles: TiaArticleItem[];
  };
}

export const departmentTiaData: Record<string, DepartmentTiaContent> = {
  "gynecology": {
    "hero": {
      "title": "Gynecology & Obstetrics care in KR Puram",
      "bullets": [
        "Women’s health, pregnancy and maternity care.",
        "Consultation, maternity and gynecological surgical care",
        "Confirm the clinician, service and availability with reception"
      ],
      "image": "/clients/sri-lakshmi/1b1261d5-gynecology-obstetrics.png",
      "imageAlt": "Gynecology & Obstetrics illustration published on the hospital website"
    },
    "services": {
      "heading": "Gynecology & Obstetrics services",
      "items": [
        {
          "category": "WOMEN’S HEALTH",
          "title": "Gynecology consultations",
          "description": "The hospital lists care for menstrual concerns, pelvic pain, fibroids, endometriosis and menopause symptoms."
        },
        {
          "category": "PREGNANCY",
          "title": "Antenatal & high-risk pregnancy care",
          "description": "Prenatal checks, pregnancy monitoring and high-risk pregnancy care appear in the published service list."
        },
        {
          "category": "MATERNITY",
          "title": "Delivery & postnatal care",
          "description": "Discuss maternity services and the appropriate hospital location with reception and your obstetrician."
        },
        {
          "category": "FAMILY SUPPORT",
          "title": "Breastfeeding & antenatal education",
          "description": "The published maternity information includes breastfeeding support and antenatal education. Confirm sessions and location with the care team."
        },
        {
          "category": "GYNECOLOGICAL SURGERY",
          "title": "Laparoscopic procedures",
          "description": "The hospital lists laparoscopic hysterectomy, myomectomy and ovarian cystectomy. Your specialist explains the suitable approach."
        },
        {
          "category": "PLANNING YOUR CARE",
          "title": "Find the right hospital location",
          "description": "Sri Lakshmi Group also lists a separate Mother and Children Hospital. Confirm where your consultation, procedure or delivery will take place."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Gynecology consultations",
          "description": "Women’s health, pregnancy and maternity care.",
          "image": "/clients/sri-lakshmi/1b1261d5-gynecology-obstetrics.png",
          "imageAlt": "Gynecology & Obstetrics illustration published on the hospital website"
        },
        {
          "title": "Antenatal care",
          "description": "Women’s health, pregnancy and maternity care.",
          "image": "/clients/sri-lakshmi/1b1261d5-gynecology-obstetrics.png",
          "imageAlt": "Gynecology & Obstetrics illustration published on the hospital website"
        },
        {
          "title": "Maternity care",
          "description": "Women’s health, pregnancy and maternity care.",
          "image": "/clients/sri-lakshmi/1b1261d5-gynecology-obstetrics.png",
          "imageAlt": "Gynecology & Obstetrics illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Women’s health, pregnancy and maternity care."
        },
        {
          "title": "Facilities behind your care",
          "description": "Confirm maternity and surgical services at the correct Sri Lakshmi hospital location."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your gynecology & obstetrics visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "general-medicine": {
    "hero": {
      "title": "General Medicine care in KR Puram",
      "bullets": [
        "Inpatient and outpatient medical consultations in KR Puram.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/36f2a4cf-home-page-banner.png",
      "imageAlt": "General Medicine illustration published on the hospital website"
    },
    "services": {
      "heading": "General Medicine services",
      "items": [
        {
          "category": "General Medicine",
          "title": "Physician consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "General Medicine",
          "title": "Preventive health checks",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "General Medicine",
          "title": "Chronic-condition care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "General Medicine",
          "title": "Follow-up consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Physician consultations",
          "description": "Inpatient and outpatient medical consultations in KR Puram.",
          "image": "/clients/sri-lakshmi/36f2a4cf-home-page-banner.png",
          "imageAlt": "General Medicine illustration published on the hospital website"
        },
        {
          "title": "Preventive health checks",
          "description": "Inpatient and outpatient medical consultations in KR Puram.",
          "image": "/clients/sri-lakshmi/36f2a4cf-home-page-banner.png",
          "imageAlt": "General Medicine illustration published on the hospital website"
        },
        {
          "title": "Chronic-condition care",
          "description": "Inpatient and outpatient medical consultations in KR Puram.",
          "image": "/clients/sri-lakshmi/36f2a4cf-home-page-banner.png",
          "imageAlt": "General Medicine illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Inpatient and outpatient medical consultations in KR Puram."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your general medicine visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "cardiology": {
    "hero": {
      "title": "Cardiology care in KR Puram",
      "bullets": [
        "Heart consultations, diagnostics and cardiac catheterization.",
        "Philips FD10 cath lab and published cardiac diagnostics",
        "Confirm the clinician, service and availability with reception"
      ],
      "image": "/clients/sri-lakshmi/0b3cc897-cardiology.png",
      "imageAlt": "Cardiology illustration published on the hospital website"
    },
    "services": {
      "heading": "Cardiology services",
      "items": [
        {
          "category": "ASSESSMENT",
          "title": "Consultations & preventive care",
          "description": "Discuss your symptoms, previous reports and heart-health risk factors with the cardiology team."
        },
        {
          "category": "DIAGNOSTICS",
          "title": "ECG, echo & stress testing",
          "description": "The hospital lists ECG, echocardiography and stress testing for cardiac assessment. Your doctor advises the appropriate test."
        },
        {
          "category": "RHYTHM ASSESSMENT",
          "title": "Holter monitoring",
          "description": "Continuous ECG recording is listed to help evaluate intermittent heart-rhythm concerns."
        },
        {
          "category": "CATH LAB",
          "title": "Coronary angiography",
          "description": "Cardiac catheterization and coronary angiography are listed alongside the hospital’s Philips FD10 cath lab."
        },
        {
          "category": "INTERVENTIONAL CARE",
          "title": "Angioplasty & stenting",
          "description": "The hospital lists angioplasty and coronary stent procedures. Treatment suitability and the planned approach are discussed with your cardiologist."
        },
        {
          "category": "SPECIALIST CARE",
          "title": "Pacemakers & rhythm evaluation",
          "description": "Pacemaker implantation and electrophysiology studies appear in the published cardiac procedure list. Confirm current availability with the care team."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "ECG",
          "description": "Heart consultations, diagnostics and cardiac catheterization.",
          "image": "/clients/sri-lakshmi/0b3cc897-cardiology.png",
          "imageAlt": "Cardiology illustration published on the hospital website"
        },
        {
          "title": "Echocardiography",
          "description": "Heart consultations, diagnostics and cardiac catheterization.",
          "image": "/clients/sri-lakshmi/0b3cc897-cardiology.png",
          "imageAlt": "Cardiology illustration published on the hospital website"
        },
        {
          "title": "Stress testing",
          "description": "Heart consultations, diagnostics and cardiac catheterization.",
          "image": "/clients/sri-lakshmi/0b3cc897-cardiology.png",
          "imageAlt": "Cardiology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Heart consultations, diagnostics and cardiac catheterization."
        },
        {
          "title": "Facilities behind your care",
          "description": "The hospital lists a Philips FD10 cardiac cath lab, echo and cardiac investigations."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your cardiology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "metabolic": {
    "hero": {
      "title": "Diabetology care in KR Puram",
      "bullets": [
        "Consultations and health checks for diabetes management.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/df0a204c-Untitled-design-39.png",
      "imageAlt": "Diabetology illustration published on the hospital website"
    },
    "services": {
      "heading": "Diabetology services",
      "items": [
        {
          "category": "Diabetology",
          "title": "Diabetes consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Diabetology",
          "title": "Blood sugar monitoring",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Diabetology",
          "title": "Diabetic health checks",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Diabetology",
          "title": "Lifestyle guidance",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Diabetes consultations",
          "description": "Consultations and health checks for diabetes management.",
          "image": "/clients/sri-lakshmi/df0a204c-Untitled-design-39.png",
          "imageAlt": "Diabetology illustration published on the hospital website"
        },
        {
          "title": "Blood sugar monitoring",
          "description": "Consultations and health checks for diabetes management.",
          "image": "/clients/sri-lakshmi/df0a204c-Untitled-design-39.png",
          "imageAlt": "Diabetology illustration published on the hospital website"
        },
        {
          "title": "Diabetic health checks",
          "description": "Consultations and health checks for diabetes management.",
          "image": "/clients/sri-lakshmi/df0a204c-Untitled-design-39.png",
          "imageAlt": "Diabetology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Consultations and health checks for diabetes management."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your diabetology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "orthopedics": {
    "hero": {
      "title": "Orthopedics care in KR Puram",
      "bullets": [
        "Consultations, fracture care and joint surgery.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/aaaa640e-Untitled-design-24-2.png",
      "imageAlt": "Orthopedics illustration published on the hospital website"
    },
    "services": {
      "heading": "Orthopedics services",
      "items": [
        {
          "category": "Orthopedics",
          "title": "Orthopedic consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Orthopedics",
          "title": "Joint replacement",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Orthopedics",
          "title": "Arthroscopic surgery",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Orthopedics",
          "title": "Fracture care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Orthopedic consultations",
          "description": "Consultations, fracture care and joint surgery.",
          "image": "/clients/sri-lakshmi/aaaa640e-Untitled-design-24-2.png",
          "imageAlt": "Orthopedics illustration published on the hospital website"
        },
        {
          "title": "Joint replacement",
          "description": "Consultations, fracture care and joint surgery.",
          "image": "/clients/sri-lakshmi/aaaa640e-Untitled-design-24-2.png",
          "imageAlt": "Orthopedics illustration published on the hospital website"
        },
        {
          "title": "Arthroscopic surgery",
          "description": "Consultations, fracture care and joint surgery.",
          "image": "/clients/sri-lakshmi/aaaa640e-Untitled-design-24-2.png",
          "imageAlt": "Orthopedics illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Consultations, fracture care and joint surgery."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your orthopedics visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "dermatology": {
    "hero": {
      "title": "Dermatology care in KR Puram",
      "bullets": [
        "Consultations for skin, hair and scalp conditions.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/786db910-Untitled-design-14-1.png",
      "imageAlt": "Dermatology illustration published on the hospital website"
    },
    "services": {
      "heading": "Dermatology services",
      "items": [
        {
          "category": "Dermatology",
          "title": "Skin consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Dermatology",
          "title": "Acne and eczema care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Dermatology",
          "title": "Hair and scalp care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Dermatology",
          "title": "Skin examinations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Skin consultations",
          "description": "Consultations for skin, hair and scalp conditions.",
          "image": "/clients/sri-lakshmi/786db910-Untitled-design-14-1.png",
          "imageAlt": "Dermatology illustration published on the hospital website"
        },
        {
          "title": "Acne and eczema care",
          "description": "Consultations for skin, hair and scalp conditions.",
          "image": "/clients/sri-lakshmi/786db910-Untitled-design-14-1.png",
          "imageAlt": "Dermatology illustration published on the hospital website"
        },
        {
          "title": "Hair and scalp care",
          "description": "Consultations for skin, hair and scalp conditions.",
          "image": "/clients/sri-lakshmi/786db910-Untitled-design-14-1.png",
          "imageAlt": "Dermatology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Consultations for skin, hair and scalp conditions."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your dermatology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "neurology": {
    "hero": {
      "title": "Neurology care in KR Puram",
      "bullets": [
        "Consultations for brain, nerve and neurological conditions.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/2e5e56ad-Untitled-design-20-1.png",
      "imageAlt": "Neurology illustration published on the hospital website"
    },
    "services": {
      "heading": "Neurology services",
      "items": [
        {
          "category": "Neurology",
          "title": "Neurology consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Neurology",
          "title": "Epilepsy care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Neurology",
          "title": "Headache consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Neurology",
          "title": "Movement-disorder care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Neurology consultations",
          "description": "Consultations for brain, nerve and neurological conditions.",
          "image": "/clients/sri-lakshmi/2e5e56ad-Untitled-design-20-1.png",
          "imageAlt": "Neurology illustration published on the hospital website"
        },
        {
          "title": "Epilepsy care",
          "description": "Consultations for brain, nerve and neurological conditions.",
          "image": "/clients/sri-lakshmi/2e5e56ad-Untitled-design-20-1.png",
          "imageAlt": "Neurology illustration published on the hospital website"
        },
        {
          "title": "Headache consultations",
          "description": "Consultations for brain, nerve and neurological conditions.",
          "image": "/clients/sri-lakshmi/2e5e56ad-Untitled-design-20-1.png",
          "imageAlt": "Neurology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Consultations for brain, nerve and neurological conditions."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your neurology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "ent": {
    "hero": {
      "title": "Ear, Nose & Throat care in KR Puram",
      "bullets": [
        "Consultations for hearing, sinus and throat concerns.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/73102a9d-Untitled-design-27-1.png",
      "imageAlt": "Ear, Nose & Throat illustration published on the hospital website"
    },
    "services": {
      "heading": "Ear, Nose & Throat services",
      "items": [
        {
          "category": "Ear, Nose & Throat",
          "title": "ENT consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Ear, Nose & Throat",
          "title": "Hearing assessments",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Ear, Nose & Throat",
          "title": "Sinus care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Ear, Nose & Throat",
          "title": "Throat examinations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "ENT consultations",
          "description": "Consultations for hearing, sinus and throat concerns.",
          "image": "/clients/sri-lakshmi/73102a9d-Untitled-design-27-1.png",
          "imageAlt": "Ear, Nose & Throat illustration published on the hospital website"
        },
        {
          "title": "Hearing assessments",
          "description": "Consultations for hearing, sinus and throat concerns.",
          "image": "/clients/sri-lakshmi/73102a9d-Untitled-design-27-1.png",
          "imageAlt": "Ear, Nose & Throat illustration published on the hospital website"
        },
        {
          "title": "Sinus care",
          "description": "Consultations for hearing, sinus and throat concerns.",
          "image": "/clients/sri-lakshmi/73102a9d-Untitled-design-27-1.png",
          "imageAlt": "Ear, Nose & Throat illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Consultations for hearing, sinus and throat concerns."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your ear, nose & throat visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "general-surgery": {
    "hero": {
      "title": "General & Laparoscopic Surgery care in KR Puram",
      "bullets": [
        "General surgical care and minimally invasive procedures.",
        "General and laparoscopic procedures with modular OT support",
        "Confirm the clinician, service and availability with reception"
      ],
      "image": "/clients/sri-lakshmi/b0edee62-Untitled-design-48.png",
      "imageAlt": "General & Laparoscopic Surgery illustration published on the hospital website"
    },
    "services": {
      "heading": "General & Laparoscopic Surgery services",
      "items": [
        {
          "category": "ASSESSMENT",
          "title": "Surgical consultations",
          "description": "Discuss the diagnosis, available approaches, preparation and recovery with the surgical team."
        },
        {
          "category": "GENERAL SURGERY",
          "title": "Appendix & hernia procedures",
          "description": "Appendectomy and repair of inguinal, femoral and umbilical hernias are listed by the hospital."
        },
        {
          "category": "LAPAROSCOPIC CARE",
          "title": "Gallbladder surgery",
          "description": "Laparoscopic cholecystectomy is listed for gallbladder removal. Your surgeon advises whether this approach is appropriate."
        },
        {
          "category": "SURGICAL CARE",
          "title": "Breast & thyroid procedures",
          "description": "The published procedure list includes breast biopsies, lumpectomies, mastectomies and thyroid surgery."
        },
        {
          "category": "ABDOMINAL CARE",
          "title": "Gastrointestinal surgery",
          "description": "The hospital lists surgical treatment for conditions including bowel obstruction and diverticulitis."
        },
        {
          "category": "FACILITIES",
          "title": "Modular operating theatre",
          "description": "Surgical care is supported by the hospital’s listed modular operating theatre, with HEPA filtration and laminar airflow."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "General surgery",
          "description": "General surgical care and minimally invasive procedures.",
          "image": "/clients/sri-lakshmi/b0edee62-Untitled-design-48.png",
          "imageAlt": "General & Laparoscopic Surgery illustration published on the hospital website"
        },
        {
          "title": "Laparoscopic surgery",
          "description": "General surgical care and minimally invasive procedures.",
          "image": "/clients/sri-lakshmi/b0edee62-Untitled-design-48.png",
          "imageAlt": "General & Laparoscopic Surgery illustration published on the hospital website"
        },
        {
          "title": "Hernia treatment",
          "description": "General surgical care and minimally invasive procedures.",
          "image": "/clients/sri-lakshmi/b0edee62-Untitled-design-48.png",
          "imageAlt": "General & Laparoscopic Surgery illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "General surgical care and minimally invasive procedures."
        },
        {
          "title": "Facilities behind your care",
          "description": "The hospital lists a modular operating theatre with HEPA filtration and laminar airflow."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your general & laparoscopic surgery visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "urology": {
    "hero": {
      "title": "Urology care in KR Puram",
      "bullets": [
        "Care for urinary tract, kidney stone and prostate conditions.",
        "100-watt Holmium laser for stone and prostate care",
        "Confirm the clinician, service and availability with reception"
      ],
      "image": "/clients/sri-lakshmi/97df52fc-urology.png",
      "imageAlt": "Urology illustration published on the hospital website"
    },
    "services": {
      "heading": "Urology services",
      "items": [
        {
          "category": "CONSULTATIONS",
          "title": "Urinary & prostate health",
          "description": "Assessment of urinary tract concerns, bladder symptoms, prostate problems and kidney stones."
        },
        {
          "category": "DIAGNOSTICS",
          "title": "Urodynamic assessment",
          "description": "Urodynamic testing is listed for evaluation of bladder and urinary function."
        },
        {
          "category": "ENDOSCOPIC CARE",
          "title": "Cystoscopy & ureteroscopy",
          "description": "The hospital lists endoscopic procedures to examine and treat conditions within the urinary tract."
        },
        {
          "category": "LASER TECHNOLOGY",
          "title": "100-watt Holmium laser",
          "description": "Holmium laser technology is published for stone and prostate care. Your urologist assesses the procedure that suits your condition."
        },
        {
          "category": "STONE CARE",
          "title": "Laser lithotripsy & PCNL",
          "description": "Laser lithotripsy and percutaneous nephrolithotomy (PCNL) appear in the hospital’s kidney-stone treatment list."
        },
        {
          "category": "PROSTATE CARE",
          "title": "TURP & treatment planning",
          "description": "Transurethral resection of the prostate (TURP) is listed among prostate procedures. Discuss benefits, preparation and the treatment plan with your specialist."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Urology consultations",
          "description": "Care for urinary tract, kidney stone and prostate conditions.",
          "image": "/clients/sri-lakshmi/97df52fc-urology.png",
          "imageAlt": "Urology illustration published on the hospital website"
        },
        {
          "title": "Kidney stone treatment",
          "description": "Care for urinary tract, kidney stone and prostate conditions.",
          "image": "/clients/sri-lakshmi/97df52fc-urology.png",
          "imageAlt": "Urology illustration published on the hospital website"
        },
        {
          "title": "Prostate care",
          "description": "Care for urinary tract, kidney stone and prostate conditions.",
          "image": "/clients/sri-lakshmi/97df52fc-urology.png",
          "imageAlt": "Urology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Care for urinary tract, kidney stone and prostate conditions."
        },
        {
          "title": "Facilities behind your care",
          "description": "A 100-watt Holmium laser is listed for stone and prostate procedures."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your urology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "nephrology": {
    "hero": {
      "title": "Nephrology care in KR Puram",
      "bullets": [
        "Kidney consultations and dialysis services.",
        "Dedicated 10-bed dialysis unit",
        "Confirm the clinician, service and availability with reception"
      ],
      "image": "/clients/sri-lakshmi/2d816a69-Untitled-design-21-1.png",
      "imageAlt": "Nephrology illustration published on the hospital website"
    },
    "services": {
      "heading": "Nephrology services",
      "items": [
        {
          "category": "KIDNEY ASSESSMENT",
          "title": "Kidney consultations",
          "description": "Evaluation and management of chronic kidney disease, acute kidney injury and other kidney-related concerns."
        },
        {
          "category": "RENAL SUPPORT",
          "title": "10-bed dialysis unit",
          "description": "The hospital lists a dedicated hemodialysis unit. Coordinate treatment sessions and preparation with the renal-care team."
        },
        {
          "category": "CHRONIC CARE",
          "title": "Diabetic & hypertensive kidney disease",
          "description": "Published services include follow-up care for kidney problems associated with diabetes and high blood pressure."
        },
        {
          "category": "SPECIALIST CARE",
          "title": "Electrolyte & fluid balance",
          "description": "Assessment of electrolyte and acid-base disorders is included in the nephrology service list."
        },
        {
          "category": "FOLLOW-UP",
          "title": "Ongoing kidney care",
          "description": "Bring previous kidney-function reports, prescriptions and dialysis records so the team can discuss the next steps in your care."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Kidney consultations",
          "description": "Kidney consultations and dialysis services.",
          "image": "/clients/sri-lakshmi/2d816a69-Untitled-design-21-1.png",
          "imageAlt": "Nephrology illustration published on the hospital website"
        },
        {
          "title": "Dialysis",
          "description": "Kidney consultations and dialysis services.",
          "image": "/clients/sri-lakshmi/2d816a69-Untitled-design-21-1.png",
          "imageAlt": "Nephrology illustration published on the hospital website"
        },
        {
          "title": "Chronic kidney disease care",
          "description": "Kidney consultations and dialysis services.",
          "image": "/clients/sri-lakshmi/2d816a69-Untitled-design-21-1.png",
          "imageAlt": "Nephrology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Kidney consultations and dialysis services."
        },
        {
          "title": "Facilities behind your care",
          "description": "Renal care is supported by the hospital’s dedicated 10-bed dialysis facility."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your nephrology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "plastic-surgery": {
    "hero": {
      "title": "Plastic Surgery care in KR Puram",
      "bullets": [
        "Reconstructive and plastic surgical consultations.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/95bfd719-Untitled-design-35-1.png",
      "imageAlt": "Plastic Surgery illustration published on the hospital website"
    },
    "services": {
      "heading": "Plastic Surgery services",
      "items": [
        {
          "category": "Plastic Surgery",
          "title": "Plastic surgery consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Plastic Surgery",
          "title": "Reconstructive surgery",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Plastic Surgery",
          "title": "Burn care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Plastic Surgery",
          "title": "Scar management",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Plastic surgery consultations",
          "description": "Reconstructive and plastic surgical consultations.",
          "image": "/clients/sri-lakshmi/95bfd719-Untitled-design-35-1.png",
          "imageAlt": "Plastic Surgery illustration published on the hospital website"
        },
        {
          "title": "Reconstructive surgery",
          "description": "Reconstructive and plastic surgical consultations.",
          "image": "/clients/sri-lakshmi/95bfd719-Untitled-design-35-1.png",
          "imageAlt": "Plastic Surgery illustration published on the hospital website"
        },
        {
          "title": "Burn care",
          "description": "Reconstructive and plastic surgical consultations.",
          "image": "/clients/sri-lakshmi/95bfd719-Untitled-design-35-1.png",
          "imageAlt": "Plastic Surgery illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Reconstructive and plastic surgical consultations."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your plastic surgery visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "emergency": {
    "hero": {
      "title": "Emergency & Trauma Care care in KR Puram",
      "bullets": [
        "Round-the-clock emergency care and intensive care facilities.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/f8fcf782-emergency-care.png",
      "imageAlt": "Emergency & Trauma Care illustration published on the hospital website"
    },
    "services": {
      "heading": "Emergency & Trauma Care services",
      "items": [
        {
          "category": "Emergency & Trauma Care",
          "title": "Emergency assessment",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Emergency & Trauma Care",
          "title": "Trauma care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Emergency & Trauma Care",
          "title": "Critical care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Emergency & Trauma Care",
          "title": "Intensive care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Emergency assessment",
          "description": "Round-the-clock emergency care and intensive care facilities.",
          "image": "/clients/sri-lakshmi/f8fcf782-emergency-care.png",
          "imageAlt": "Emergency & Trauma Care illustration published on the hospital website"
        },
        {
          "title": "Trauma care",
          "description": "Round-the-clock emergency care and intensive care facilities.",
          "image": "/clients/sri-lakshmi/f8fcf782-emergency-care.png",
          "imageAlt": "Emergency & Trauma Care illustration published on the hospital website"
        },
        {
          "title": "Critical care",
          "description": "Round-the-clock emergency care and intensive care facilities.",
          "image": "/clients/sri-lakshmi/f8fcf782-emergency-care.png",
          "imageAlt": "Emergency & Trauma Care illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Round-the-clock emergency care and intensive care facilities."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your emergency & trauma care visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "anesthesiology": {
    "hero": {
      "title": "Anaesthesiology care in KR Puram",
      "bullets": [
        "Anaesthesia support for surgery and procedures.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/e8c1a908-Untitled-design.png",
      "imageAlt": "Anaesthesiology illustration published on the hospital website"
    },
    "services": {
      "heading": "Anaesthesiology services",
      "items": [
        {
          "category": "Anaesthesiology",
          "title": "Pre-operative assessment",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Anaesthesiology",
          "title": "Anaesthesia",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Anaesthesiology",
          "title": "Pain management",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Anaesthesiology",
          "title": "Perioperative care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Pre-operative assessment",
          "description": "Anaesthesia support for surgery and procedures.",
          "image": "/clients/sri-lakshmi/e8c1a908-Untitled-design.png",
          "imageAlt": "Anaesthesiology illustration published on the hospital website"
        },
        {
          "title": "Anaesthesia",
          "description": "Anaesthesia support for surgery and procedures.",
          "image": "/clients/sri-lakshmi/e8c1a908-Untitled-design.png",
          "imageAlt": "Anaesthesiology illustration published on the hospital website"
        },
        {
          "title": "Pain management",
          "description": "Anaesthesia support for surgery and procedures.",
          "image": "/clients/sri-lakshmi/e8c1a908-Untitled-design.png",
          "imageAlt": "Anaesthesiology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Anaesthesia support for surgery and procedures."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your anaesthesiology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "pulmonology": {
    "hero": {
      "title": "Pulmonology care in KR Puram",
      "bullets": [
        "Consultations for respiratory and lung conditions.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/df0a204c-Untitled-design-39.png",
      "imageAlt": "Pulmonology illustration published on the hospital website"
    },
    "services": {
      "heading": "Pulmonology services",
      "items": [
        {
          "category": "Pulmonology",
          "title": "Respiratory consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Pulmonology",
          "title": "Lung function testing",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Pulmonology",
          "title": "Asthma care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Pulmonology",
          "title": "Sleep-related breathing care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Respiratory consultations",
          "description": "Consultations for respiratory and lung conditions.",
          "image": "/clients/sri-lakshmi/df0a204c-Untitled-design-39.png",
          "imageAlt": "Pulmonology illustration published on the hospital website"
        },
        {
          "title": "Lung function testing",
          "description": "Consultations for respiratory and lung conditions.",
          "image": "/clients/sri-lakshmi/df0a204c-Untitled-design-39.png",
          "imageAlt": "Pulmonology illustration published on the hospital website"
        },
        {
          "title": "Asthma care",
          "description": "Consultations for respiratory and lung conditions.",
          "image": "/clients/sri-lakshmi/df0a204c-Untitled-design-39.png",
          "imageAlt": "Pulmonology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Consultations for respiratory and lung conditions."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your pulmonology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "radiology": {
    "hero": {
      "title": "Radiology care in KR Puram",
      "bullets": [
        "Diagnostic imaging, echo and ultrasound facilities.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/99309903-1-5.png",
      "imageAlt": "Radiology illustration published on the hospital website"
    },
    "services": {
      "heading": "Radiology services",
      "items": [
        {
          "category": "Radiology",
          "title": "Diagnostic imaging",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Radiology",
          "title": "Ultrasound",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Radiology",
          "title": "Radiology consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Radiology",
          "title": "Imaging interpretation",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Diagnostic imaging",
          "description": "Diagnostic imaging, echo and ultrasound facilities.",
          "image": "/clients/sri-lakshmi/99309903-1-5.png",
          "imageAlt": "Radiology illustration published on the hospital website"
        },
        {
          "title": "Ultrasound",
          "description": "Diagnostic imaging, echo and ultrasound facilities.",
          "image": "/clients/sri-lakshmi/99309903-1-5.png",
          "imageAlt": "Radiology illustration published on the hospital website"
        },
        {
          "title": "Radiology consultations",
          "description": "Diagnostic imaging, echo and ultrasound facilities.",
          "image": "/clients/sri-lakshmi/99309903-1-5.png",
          "imageAlt": "Radiology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Diagnostic imaging, echo and ultrasound facilities."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your radiology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "psychiatry": {
    "hero": {
      "title": "Psychiatry care in KR Puram",
      "bullets": [
        "Consultations for mental health and wellbeing.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/2e5e56ad-Untitled-design-20-1.png",
      "imageAlt": "Psychiatry illustration published on the hospital website"
    },
    "services": {
      "heading": "Psychiatry services",
      "items": [
        {
          "category": "Psychiatry",
          "title": "Psychiatry consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Psychiatry",
          "title": "Mental health assessments",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Psychiatry",
          "title": "Follow-up care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Psychiatry",
          "title": "Counselling enquiries",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Psychiatry consultations",
          "description": "Consultations for mental health and wellbeing.",
          "image": "/clients/sri-lakshmi/2e5e56ad-Untitled-design-20-1.png",
          "imageAlt": "Psychiatry illustration published on the hospital website"
        },
        {
          "title": "Mental health assessments",
          "description": "Consultations for mental health and wellbeing.",
          "image": "/clients/sri-lakshmi/2e5e56ad-Untitled-design-20-1.png",
          "imageAlt": "Psychiatry illustration published on the hospital website"
        },
        {
          "title": "Follow-up care",
          "description": "Consultations for mental health and wellbeing.",
          "image": "/clients/sri-lakshmi/2e5e56ad-Untitled-design-20-1.png",
          "imageAlt": "Psychiatry illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Consultations for mental health and wellbeing."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your psychiatry visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "dialysis": {
    "hero": {
      "title": "Dialysis care in KR Puram",
      "bullets": [
        "Dialysis services supported by a dedicated unit.",
        "Hemodialysis services in a dedicated unit",
        "Confirm the clinician, service and availability with reception"
      ],
      "image": "/clients/sri-lakshmi/c3c3d54f-1-8.png",
      "imageAlt": "Dialysis illustration published on the hospital website"
    },
    "services": {
      "heading": "Dialysis services",
      "items": [
        {
          "category": "RENAL SUPPORT",
          "title": "Dedicated 10-bed unit",
          "description": "The hospital publishes a 10-bed dialysis facility with hemodialysis equipment."
        },
        {
          "category": "TREATMENT PLANNING",
          "title": "Coordinate your sessions",
          "description": "Discuss the prescribed dialysis schedule, availability and preparation with the renal-care team."
        },
        {
          "category": "CONTINUITY",
          "title": "Keep your records ready",
          "description": "Bring your dialysis summary, recent reports and current prescriptions for the team to review."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Dialysis",
          "description": "Dialysis services supported by a dedicated unit.",
          "image": "/clients/sri-lakshmi/c3c3d54f-1-8.png",
          "imageAlt": "Dialysis illustration published on the hospital website"
        },
        {
          "title": "Nephrology support",
          "description": "Dialysis services supported by a dedicated unit.",
          "image": "/clients/sri-lakshmi/c3c3d54f-1-8.png",
          "imageAlt": "Dialysis illustration published on the hospital website"
        },
        {
          "title": "Renal care",
          "description": "Dialysis services supported by a dedicated unit.",
          "image": "/clients/sri-lakshmi/c3c3d54f-1-8.png",
          "imageAlt": "Dialysis illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Dialysis services supported by a dedicated unit."
        },
        {
          "title": "Facilities behind your care",
          "description": "The hospital lists a dedicated 10-bed hemodialysis unit."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your dialysis visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "gastroenterology": {
    "hero": {
      "title": "Gastroenterology care in KR Puram",
      "bullets": [
        "Consultations for digestive and gastrointestinal conditions.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/d638f6e9-Untitled-design-28.png",
      "imageAlt": "Gastroenterology illustration published on the hospital website"
    },
    "services": {
      "heading": "Gastroenterology services",
      "items": [
        {
          "category": "Gastroenterology",
          "title": "Digestive health consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Gastroenterology",
          "title": "Gastrointestinal care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Gastroenterology",
          "title": "Endoscopy enquiries",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Gastroenterology",
          "title": "Follow-up care",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Digestive health consultations",
          "description": "Consultations for digestive and gastrointestinal conditions.",
          "image": "/clients/sri-lakshmi/d638f6e9-Untitled-design-28.png",
          "imageAlt": "Gastroenterology illustration published on the hospital website"
        },
        {
          "title": "Gastrointestinal care",
          "description": "Consultations for digestive and gastrointestinal conditions.",
          "image": "/clients/sri-lakshmi/d638f6e9-Untitled-design-28.png",
          "imageAlt": "Gastroenterology illustration published on the hospital website"
        },
        {
          "title": "Endoscopy enquiries",
          "description": "Consultations for digestive and gastrointestinal conditions.",
          "image": "/clients/sri-lakshmi/d638f6e9-Untitled-design-28.png",
          "imageAlt": "Gastroenterology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Consultations for digestive and gastrointestinal conditions."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your gastroenterology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  },
  "oncology": {
    "hero": {
      "title": "Oncology care in KR Puram",
      "bullets": [
        "Oncology consultations with Dr. Surendra Reddy.",
        "Sri Lakshmi Super Speciality Hospital",
        "Contact the hospital for appointments"
      ],
      "image": "/clients/sri-lakshmi/36f2a4cf-home-page-banner.png",
      "imageAlt": "Oncology illustration published on the hospital website"
    },
    "services": {
      "heading": "Oncology services",
      "items": [
        {
          "category": "Oncology",
          "title": "Oncology consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Oncology",
          "title": "Specialist assessment",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Oncology",
          "title": "Treatment planning enquiries",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        },
        {
          "category": "Oncology",
          "title": "Follow-up consultations",
          "description": "Contact the hospital to discuss this service and confirm availability, suitability and fees."
        }
      ]
    },
    "symptoms": {
      "heading": "Explore care options",
      "slides": [
        {
          "title": "Oncology consultations",
          "description": "Oncology consultations with Dr. Surendra Reddy.",
          "image": "/clients/sri-lakshmi/36f2a4cf-home-page-banner.png",
          "imageAlt": "Oncology illustration published on the hospital website"
        },
        {
          "title": "Specialist assessment",
          "description": "Oncology consultations with Dr. Surendra Reddy.",
          "image": "/clients/sri-lakshmi/36f2a4cf-home-page-banner.png",
          "imageAlt": "Oncology illustration published on the hospital website"
        },
        {
          "title": "Treatment planning enquiries",
          "description": "Oncology consultations with Dr. Surendra Reddy.",
          "image": "/clients/sri-lakshmi/36f2a4cf-home-page-banner.png",
          "imageAlt": "Oncology illustration published on the hospital website"
        }
      ]
    },
    "whyMatters": {
      "heading": "Care close to home",
      "pillars": [
        {
          "title": "Specialty consultations",
          "description": "Oncology consultations with Dr. Surendra Reddy."
        },
        {
          "title": "Hospital facilities",
          "description": "The KR Puram hospital lists emergency care, laboratory, pharmacy and inpatient facilities."
        },
        {
          "title": "Plan your visit",
          "description": "Confirm doctor availability and bring your previous medical records."
        }
      ]
    },
    "cta": {
      "heading": "Plan your oncology visit",
      "description": "Contact the hospital to confirm consultation times and fees."
    },
    "resources": {
      "heading": "Before your visit",
      "articles": [
        {
          "tag": "APPOINTMENTS",
          "title": "Confirm your appointment details",
          "snippet": "Ask the hospital about the clinician, date, time and consultation fee."
        },
        {
          "tag": "PATIENT CARE",
          "title": "Keep your records ready",
          "snippet": "Bring recent reports, prescriptions and your questions for the doctor."
        }
      ]
    }
  }
};

export function getDepartmentTiaContent(departmentId: string): DepartmentTiaContent {
  const content = departmentTiaData[departmentId];
  if (!content) throw new Error(`No department page content for ${departmentId}`);
  return content;
}
