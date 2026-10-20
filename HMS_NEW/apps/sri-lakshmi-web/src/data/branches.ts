// Source: https://slsshospitals.com/our-locations/. Group locations are not a shared booking roster.
export interface Branch {
  id: string;
  name: string;
  area: string;
  virtual?: boolean;
  address?: string;
  phone?: string;
  image?: string;
}
export const branches: Branch[] = [
  {
    "id": "kr-puram",
    "name": "Sri Lakshmi Super Speciality Hospital, KR Puram",
    "area": "KR Puram",
    "address": "301, 3rd Main Rd, near Indane Gas, V B Layout, Old Extension, Krishnarajapuram, Bengaluru 560036",
    "phone": "+91 99017 11716",
    "image": "/clients/sri-lakshmi/7e984e74-3-1.png"
  },
  {
    "id": "kaggadasapura",
    "name": "Sri Lakshmi Super Specialty Hospital, Kaggadasapura",
    "area": "Kaggadasapura",
    "address": "No. 5,6,7, 1st Cross, Kaggadasapura Main Rd, Nagappareddy Layout, C V Raman Nagar, Bengaluru 560093",
    "phone": "080 4167 6336",
    "image": "/clients/sri-lakshmi/3c32590a-1-1.png"
  },
  {
    "id": "koramangala",
    "name": "Sri Lakshmi Global Hospital, Koramangala",
    "area": "Koramangala",
    "address": "86, Hosur Rd, Zuzuvadi, Madiwala, 1st Stage, BTM Layout, Bengaluru 560068",
    "phone": "+91 90083 18003",
    "image": "/clients/sri-lakshmi/24ad95cb-2-1.png"
  },
  {
    "id": "mother-child",
    "name": "Sri Lakshmi Mother and Children Hospital, KR Puram",
    "area": "KR Puram (Mother & Children)",
    "address": "849/678, katha, No. 145, Old Extension, Krishnarajapuram, Bengaluru 560036",
    "phone": "+91 99008 00533",
    "image": "/clients/sri-lakshmi/003b67f5-4-1.png"
  }
];
export const physicalBranches = branches.filter(b => !b.virtual);
export const branchAreaList = 'KR Puram, Kaggadasapura and Koramangala';
