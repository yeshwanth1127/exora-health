import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HmsDoctorDirectory } from '../components/doctor/HmsDoctorDirectory';
import { HmsDoctorProfile } from '../components/doctor/HmsDoctorProfile';
import { HmsDoctorPhoto } from '../components/doctor/HmsDoctorPhoto';
import { LightDoctorsGridSection } from '../components/variants/LightDoctorsGridSection';
import { DepartmentPage } from '../components/departments/DepartmentPage';
import { WhyChooseUsSection } from '../components/sections/WhyChooseUsSection';
import type { HmsRosterDoctor } from '../components/doctor/hmsRoster';

const physician: HmsRosterDoctor = { slug: 'current-physician', name: 'Dr Current Physician', specialty: 'General Medicine', acceptsVirtual: true, websiteIds: [], qualifications: ['MBBS'], bio: 'Published clinician biography.', experienceYears: 7, languages: ['Kannada', 'English'], photoUrl: '/published-doctor.jpg', departments: ['General Medicine'] };
const callbacks = { onBackToHome: vi.fn(), onSelectDoctor: vi.fn(), onBookDoctor: vi.fn(), onExploreDepartments: vi.fn() };

describe('HMS public doctor presentation', () => {
  it('follows the current backend roster and routes with its public slug', () => {
    const book = vi.fn();
    const view = render(<HmsDoctorDirectory roster={[physician]} clinicName="Sri Lakshmi Hospital" {...callbacks} onBookDoctor={book} />);
    fireEvent.click(screen.getByRole('button', { name: 'Book appointment' }));
    expect(book).toHaveBeenCalledWith('current-physician');
    view.rerender(<HmsDoctorDirectory roster={[{ ...physician, name: 'Dr Updated Physician', slug: 'updated-physician' }]} clinicName="Sri Lakshmi Hospital" {...callbacks} />);
    expect(screen.queryByText('Dr Current Physician')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dr Updated Physician' })).toBeInTheDocument();
  });
  it('never replaces an empty or failed catalog with the legacy website team', () => {
    const view = render(<HmsDoctorDirectory roster={[]} clinicName="Sri Lakshmi Hospital" {...callbacks} />);
    expect(screen.getByText('No doctors are published for online booking yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book appointment' })).not.toBeInTheDocument();
    view.rerender(<HmsDoctorDirectory roster={[]} clinicName="Sri Lakshmi Hospital" error="Cannot load hospital doctors" {...callbacks} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot load hospital doctors');
    expect(screen.queryByRole('button', { name: 'Book appointment' })).not.toBeInTheDocument();
  });
  it('filters only published doctors for teleconsultation and specialty', () => {
    render(<HmsDoctorDirectory roster={[physician, { ...physician, slug: 'other', name: 'Dr Other', acceptsVirtual: false, specialty: 'Orthopaedics', departments: ['Orthopaedics'] }]} clinicName="Sri Lakshmi Hospital" initialVirtual initialSpecialty="general-medicine" {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Dr Current Physician' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dr Other' })).not.toBeInTheDocument();
  });
  it('renders only supported profile values and has no fallback doctor', () => {
    const props = { clinicName: 'Sri Lakshmi Hospital', onBackToSearch: vi.fn(), onBackToHome: vi.fn(), onScheduleAppointment: vi.fn() };
    const view = render(<HmsDoctorProfile doctor={{ ...physician, qualifications: [], bio: null, experienceYears: null, languages: [], photoUrl: null }} {...props} />);
    expect(screen.getByRole('heading', { name: 'Dr Current Physician' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Qualifications' })).not.toBeInTheDocument();
    expect(screen.queryByText(/years of experience/)).not.toBeInTheDocument();
    expect(screen.queryByText(/rating|reviews|₹/i)).not.toBeInTheDocument();
    view.rerender(<HmsDoctorProfile {...props} />);
    expect(screen.queryByText('Dr Current Physician')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('not currently published');
  });
  it('uses initials when the backend photo is absent or fails', () => {
    const view = render(<HmsDoctorPhoto name="Dr Current Physician" url="/missing.jpg" />);
    fireEvent.error(view.container.querySelector('img')!);
    expect(screen.getByLabelText('Photo unavailable for Dr Current Physician')).toHaveTextContent('CP');
    expect(view.container.querySelector('img')).toBeNull();
  });
  it('uses the dynamic roster for homepage and department cards', () => {
    const home = render(<LightDoctorsGridSection roster={[physician]} />);
    expect(screen.getByRole('button', { name: 'Dr Current Physician' })).toBeInTheDocument();
    home.unmount();
    render(<DepartmentPage roster={[physician]} rosterClinicName="Sri Lakshmi Hospital" departmentId="general-medicine" onBackToHome={vi.fn()} onBackToDepartments={vi.fn()} onSelectDepartment={vi.fn()} onViewDoctor={vi.fn()} onBookDoctor={vi.fn()} onOpenBooking={vi.fn()} />);
    expect(screen.getByText('Dr Current Physician')).toBeInTheDocument();
    expect(screen.getByText('Published clinician biography.')).toBeInTheDocument();
  });
  it('publishes current clinician counts instead of legacy unsupported figures', () => {
    render(<WhyChooseUsSection roster={[physician]} />);
    expect(screen.getByText('Doctors available for online booking')).toBeInTheDocument();
    expect(screen.queryByText('50,000+')).not.toBeInTheDocument();
    expect(screen.queryByText('50+')).not.toBeInTheDocument();
  });
});
