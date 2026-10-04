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

export const membershipFeatures: string[] = [];
export const healthTiers: HealthTier[] = [];
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
    "id": "diabetic-check-up",
    "category": "Master",
    "title": "Diabetic Check Up",
    "shortDescription": "A focused check-up for diabetes monitoring.",
    "keyInclusionsSummary": "Confirm the exact test list with the hospital",
    "testsCount": 0,
    "reportDeliveryHours": 0,
    "price": 749,
    "originalPrice": 1000,
    "discountPercentage": 25,
    "headerColor": "#154734",
    "accentBg": "#eaf3ed",
    "homeCollectionAvailable": false,
    "detailedInclusions": [
      {
        "category": "Before booking",
        "tests": [
          "Confirm package inclusions and preparation requirements",
          "Confirm current price with the hospital"
        ]
      }
    ]
  },
  {
    "id": "fertility-health-check-up",
    "category": "Master",
    "title": "Fertility Health Check Up",
    "shortDescription": "A fertility health assessment package.",
    "keyInclusionsSummary": "Confirm the exact test list with the hospital",
    "testsCount": 0,
    "reportDeliveryHours": 0,
    "price": 3699,
    "originalPrice": 4955,
    "discountPercentage": 25,
    "headerColor": "#154734",
    "accentBg": "#eaf3ed",
    "homeCollectionAvailable": false,
    "detailedInclusions": [
      {
        "category": "Before booking",
        "tests": [
          "Confirm package inclusions and preparation requirements",
          "Confirm current price with the hospital"
        ]
      }
    ]
  },
  {
    "id": "general-diabetic-health-check-up",
    "category": "Master",
    "title": "General Diabetic Health Check Up",
    "shortDescription": "A broader diabetic health profile.",
    "keyInclusionsSummary": "Confirm the exact test list with the hospital",
    "testsCount": 0,
    "reportDeliveryHours": 0,
    "price": 2399,
    "originalPrice": 3955,
    "discountPercentage": 39,
    "headerColor": "#154734",
    "accentBg": "#eaf3ed",
    "homeCollectionAvailable": false,
    "detailedInclusions": [
      {
        "category": "Before booking",
        "tests": [
          "Confirm package inclusions and preparation requirements",
          "Confirm current price with the hospital"
        ]
      }
    ]
  },
  {
    "id": "advance-health-check-up",
    "category": "Master",
    "title": "Advance Health Check Up",
    "shortDescription": "An advanced health screening package.",
    "keyInclusionsSummary": "Confirm the exact test list with the hospital",
    "testsCount": 0,
    "reportDeliveryHours": 0,
    "price": 2699,
    "originalPrice": 3955,
    "discountPercentage": 32,
    "headerColor": "#154734",
    "accentBg": "#eaf3ed",
    "homeCollectionAvailable": false,
    "detailedInclusions": [
      {
        "category": "Before booking",
        "tests": [
          "Confirm package inclusions and preparation requirements",
          "Confirm current price with the hospital"
        ]
      }
    ]
  },
  {
    "id": "antenatal-profile",
    "category": "Master",
    "title": "Antenatal Profile",
    "shortDescription": "A prenatal health assessment package.",
    "keyInclusionsSummary": "Confirm the exact test list with the hospital",
    "testsCount": 0,
    "reportDeliveryHours": 0,
    "price": 3199,
    "originalPrice": 4955,
    "discountPercentage": 35,
    "headerColor": "#154734",
    "accentBg": "#eaf3ed",
    "homeCollectionAvailable": false,
    "detailedInclusions": [
      {
        "category": "Before booking",
        "tests": [
          "Confirm package inclusions and preparation requirements",
          "Confirm current price with the hospital"
        ]
      }
    ]
  },
  {
    "id": "general-health-check-up",
    "category": "Master",
    "title": "General Health Check Up",
    "shortDescription": "A routine health screening package.",
    "keyInclusionsSummary": "Confirm the exact test list with the hospital",
    "testsCount": 0,
    "reportDeliveryHours": 0,
    "price": 3999,
    "originalPrice": 4955,
    "discountPercentage": 19,
    "headerColor": "#154734",
    "accentBg": "#eaf3ed",
    "homeCollectionAvailable": false,
    "detailedInclusions": [
      {
        "category": "Before booking",
        "tests": [
          "Confirm package inclusions and preparation requirements",
          "Confirm current price with the hospital"
        ]
      }
    ]
  },
  {
    "id": "complete-health-check-up",
    "category": "Master",
    "title": "Complete Health CheckUp",
    "shortDescription": "A comprehensive health assessment package.",
    "keyInclusionsSummary": "Confirm the exact test list with the hospital",
    "testsCount": 0,
    "reportDeliveryHours": 0,
    "price": 8599,
    "originalPrice": 9955,
    "discountPercentage": 14,
    "headerColor": "#154734",
    "accentBg": "#eaf3ed",
    "homeCollectionAvailable": false,
    "detailedInclusions": [
      {
        "category": "Before booking",
        "tests": [
          "Confirm package inclusions and preparation requirements",
          "Confirm current price with the hospital"
        ]
      }
    ]
  },
  {
    "id": "cardiac-health-check-up",
    "category": "Master",
    "title": "Cardiac Health Check Up",
    "shortDescription": "A heart health screening package.",
    "keyInclusionsSummary": "Confirm the exact test list with the hospital",
    "testsCount": 0,
    "reportDeliveryHours": 0,
    "price": 2500,
    "originalPrice": 4955,
    "discountPercentage": 50,
    "headerColor": "#154734",
    "accentBg": "#eaf3ed",
    "homeCollectionAvailable": false,
    "detailedInclusions": [
      {
        "category": "Before booking",
        "tests": [
          "Confirm package inclusions and preparation requirements",
          "Confirm current price with the hospital"
        ]
      }
    ]
  }
];
