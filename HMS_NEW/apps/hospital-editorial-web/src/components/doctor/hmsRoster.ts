import type { PublicDoctor } from '../../lib/publicBookingApi';

export type HmsRosterDoctor = PublicDoctor & {
  qualifications: string[];
  bio: string | null;
  experienceYears: number | null;
  languages: string[];
  photoUrl: string | null;
  departments: string[];
};
export type RosterCard = {
  id: string; name: string; title: string; departmentName: string;
  image: string | null; bio: string; roomNumber: string; acceptsVirtual: boolean;
};
export function rosterCard(doctor: HmsRosterDoctor, clinicName = ''): RosterCard {
  return { id: doctor.slug, name: doctor.name, title: doctor.roleTitle ?? doctor.specialty ?? '',
    departmentName: doctor.departments.join(' · ') || doctor.specialty || '',
    image: doctor.photoUrl, bio: doctor.bio ?? '', roomNumber: clinicName,
    acceptsVirtual: doctor.acceptsVirtual };
}
export function departmentMatches(doctor: HmsRosterDoctor, id: string, name: string) {
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [...doctor.departments, ...(doctor.specialty ? [doctor.specialty] : [])]
    .some(value => normalized(value) === normalized(id) || normalized(value) === normalized(name));
}
