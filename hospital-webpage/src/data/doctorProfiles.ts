import { doctors } from './doctors';
import { hospitalInfo } from './hospitalInfo';
import { clientAsset } from './clientAssets';
import type { DoctorScheduleProfile } from '../components/booking/ScheduleAppointmentPage';

export const DOCTOR_PROFILES: DoctorScheduleProfile[] = doctors.map(d => ({
  id: d.id, name: d.name, credentials: 'Credentials to be confirmed', specialty: d.title,
  photo: d.image, rating: 0, reviewCount: 0,
  boardCertified: 'Not published on the hospital website', pedigree: 'Consultation hours and fees: contact hospital',
  hospitalAffiliation: hospitalInfo.name, practiceName: hospitalInfo.name,
  addressLine1: hospitalInfo.address.street, addressLine2: 'KR Puram, Bengaluru 560036',
  phone: hospitalInfo.phone, offersVideo: false, availableSlots: {}, bio: d.bio,
  nextVisitText: 'Confirm with hospital', nicheExpertise: d.departmentName,
  education: d.qualifications, clinicalInterests: [d.departmentName],
  facilityPhotos: [
    { url: clientAsset('2024/12/1-1.png'), title: 'KR Puram hospital exterior' },
    { url: clientAsset('2024/12/13.png'), title: 'Hospital reception' },
    { url: clientAsset('2024/12/1-8.png'), title: 'Dialysis facilities' },
  ],
}));
