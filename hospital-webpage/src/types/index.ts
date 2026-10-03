export interface Doctor {
  id: string;
  name: string;
  title: string;
  departmentId: string;
  departmentName: string;
  qualifications: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  consultationFee: number;
  availableDays: string[]; // e.g. ["Mon", "Tue", "Wed", "Thu", "Fri"]
  timeSlots: string[]; // e.g. ["09:00 AM", "10:30 AM", "02:00 PM", "04:30 PM"]
  image: string;
  bio: string;
  roomNumber: string;
  acceptsVirtual: boolean;
}

export interface Department {
  id: string;
  name: string;
  tagline: string;
  description: string;
  iconName: string;
  doctorCount: number;
  commonProcedures: string[];
}

export interface AppointmentBooking {
  doctorId: string;
  doctorName: string;
  departmentName: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  patientAge: number;
  patientGender: 'Male' | 'Female' | 'Other';
  date: string;
  timeSlot: string;
  consultationType: 'In-person' | 'Virtual Video';
  reasonForVisit: string;
}

export interface HospitalConfig {
  name: string;
  shortName: string;
  tagline: string;
  phone: string;
  emergencyPhone: string;
  ambulancePhone: string;
  whatsappNumber: string;
  defaultWhatsAppMessage: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    mapsUrl: string;
  };
  emergencyOpen24x7: boolean;
  opdHours: string;
}
