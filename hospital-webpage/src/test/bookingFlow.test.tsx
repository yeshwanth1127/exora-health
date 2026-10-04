import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ScheduleAppointmentPage } from '../components/booking/ScheduleAppointmentPage';
import { DOCTOR_PROFILES } from '../data/doctorProfiles';

describe('Booking Flow & Form Validation State Machine', () => {
  const sampleDoctor = DOCTOR_PROFILES[0];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Step 1: Appointment Details & Slot Selection', () => {
    it('renders clinician summary, location, and visit type controls', () => {
      render(
        <ScheduleAppointmentPage
          doctor={sampleDoctor}
          onBackToSearch={vi.fn()}
          onBackToHome={vi.fn()}
          onOpenLogin={vi.fn()}
          user={null}
        />
      );

      // Verify clinician details
      expect(screen.getAllByText(sampleDoctor.name).length).toBeGreaterThan(0);
      expect(screen.getByText(sampleDoctor.specialty)).toBeInTheDocument();

      // Check visit type toggle
      const officeRadio = screen.getByRole('radio', { name: /Office Visit/i });
      const videoRadio = screen.getByRole('radio', { name: /Video Visit/i });
      expect(officeRadio).toBeInTheDocument();
      expect(videoRadio).toBeInTheDocument();
    });

    it('transitions from Step 1 to Step 2 when a time slot is selected', () => {
      render(
        <ScheduleAppointmentPage
          doctor={sampleDoctor}
          onBackToSearch={vi.fn()}
          onBackToHome={vi.fn()}
          onOpenLogin={vi.fn()}
          user={null}
        />
      );

      // Find an available time slot button (e.g., 09:00 AM, 10:00 AM, etc.)
      const slotButtons = screen.getAllByRole('button', { name: /\d{1,2}:\d{2}\s*(AM|PM)/i });
      expect(slotButtons.length).toBeGreaterThan(0);

      // Select the first slot
      fireEvent.click(slotButtons[0]);

      // Should advance to Step 2: Patient Information
      expect(screen.getByText(/Patient Information/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Legal full name/i)).toBeInTheDocument();
    });
  });

  describe('Step 2: Patient Information Form Validation State Machine', () => {
    it('enforces required fields and stops with exact error reasons', () => {
      render(
        <ScheduleAppointmentPage
          doctor={sampleDoctor}
          initialStep={2}
          onBackToSearch={vi.fn()}
          onBackToHome={vi.fn()}
          onOpenLogin={vi.fn()}
          user={null}
        />
      );

      // Attempt to submit empty form
      const continueBtn = screen.getByRole('button', { name: /Review visit details/i });
      fireEvent.click(continueBtn);

      // 1. Legal full name validation error
      expect(screen.getByText('Full name is required')).toBeInTheDocument();

      // 2. DOB validation error
      expect(screen.getByText('A valid date is required')).toBeInTheDocument();

      // 3. Gender validation error
      expect(screen.getByText('This field is required')).toBeInTheDocument();

      // 4. Mobile phone error
      expect(screen.getByText('Mobile phone number is required')).toBeInTheDocument();
    });

    it('rejects single names and requires both first and last name', () => {
      render(
        <ScheduleAppointmentPage
          doctor={sampleDoctor}
          initialStep={2}
          onBackToSearch={vi.fn()}
          onBackToHome={vi.fn()}
          onOpenLogin={vi.fn()}
          user={null}
        />
      );

      const nameInput = screen.getByLabelText(/Legal full name/i);
      fireEvent.change(nameInput, { target: { value: 'Madonna' } });

      const continueBtn = screen.getByRole('button', { name: /Review visit details/i });
      fireEvent.click(continueBtn);

      expect(screen.getByText('Please enter both your first and last name')).toBeInTheDocument();

      // Enter both first and last name
      fireEvent.change(nameInput, { target: { value: 'Madonna Ciccone' } });
      fireEvent.click(continueBtn);

      // Full name error should now be gone
      expect(screen.queryByText('Please enter both your first and last name')).not.toBeInTheDocument();
      expect(screen.queryByText('Full name is required')).not.toBeInTheDocument();
    });

    it('blocks progression and demands OTP verification before advancing', () => {
      render(
        <ScheduleAppointmentPage
          doctor={sampleDoctor}
          initialStep={2}
          onBackToSearch={vi.fn()}
          onBackToHome={vi.fn()}
          onOpenLogin={vi.fn()}
          user={null}
        />
      );

      // Fill in name, DOB, and Gender
      fireEvent.change(screen.getByLabelText(/Legal full name/i), { target: { value: 'Jane Doe' } });
      fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '1992-05-15' } });
      fireEvent.click(screen.getByLabelText(/^Female$/i));

      // Fill mobile phone number
      const phoneInput = screen.getByLabelText(/Mobile phone/i);
      fireEvent.change(phoneInput, { target: { value: '9876543210' } });

      // Click continue without OTP verification
      const continueBtn = screen.getByRole('button', { name: /Review visit details/i });
      fireEvent.click(continueBtn);

      // Must halt and demand OTP code
      expect(screen.getByText('Enter a six-digit demo code before continuing')).toBeInTheDocument();

      // Verify OTP inputs are now visible
      const otpInputs = screen.getAllByRole('textbox').filter((el) => (el as HTMLInputElement).maxLength === 1);
      expect(otpInputs).toHaveLength(6);
    });

    it('verifies 6-digit OTP code and successfully advances to Step 3 confirmation', async () => {
      render(
        <ScheduleAppointmentPage
          doctor={sampleDoctor}
          initialStep={2}
          onBackToSearch={vi.fn()}
          onBackToHome={vi.fn()}
          onOpenLogin={vi.fn()}
          user={null}
        />
      );

      // 1. Fill Valid Details
      fireEvent.change(screen.getByLabelText(/Legal full name/i), { target: { value: 'Priya Sharma' } });
      fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '1990-08-20' } });
      fireEvent.click(screen.getByLabelText(/^Female$/i));

      const phoneInput = screen.getByLabelText(/Mobile phone/i);
      fireEvent.change(phoneInput, { target: { value: '9845012345' } });

      // Request OTP
      const sendOtpBtn = screen.getByRole('button', { name: /demo code/i });
      fireEvent.click(sendOtpBtn);

      // Fill first 5 digits
      const otpInputs = screen.getAllByRole('textbox').filter((el) => (el as HTMLInputElement).maxLength === 1);
      ['1', '2', '3', '4', '5'].forEach((digit, i) => {
        fireEvent.change(otpInputs[i], { target: { value: digit } });
      });

      // Attempt manual verification with 5 digits -> should show error
      const verifyBtn = screen.getByRole('button', { name: /Verify code/i });
      fireEvent.click(verifyBtn);
      expect(screen.getByText('Enter all 6 digits of the demo code')).toBeInTheDocument();

      // Enter 6th digit -> triggers auto-verification and clears error
      fireEvent.change(otpInputs[5], { target: { value: '6' } });

      // Verify success badge appears
      expect(screen.getByText(/Demo code accepted/i)).toBeInTheDocument();

      // Submit form
      const continueBtn = screen.getByRole('button', { name: /Review visit details/i });
      fireEvent.click(continueBtn);

      // Should advance to Step 3: Confirmation
      await waitFor(() => {
        expect(screen.getByText(/Walkthrough complete/i)).toBeInTheDocument();
      });

      // Verify booked clinician and patient name on Step 3
      expect(screen.getAllByText(sampleDoctor.name).length).toBeGreaterThan(0);
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    it('handles optional email correctly (allows empty, rejects invalid, accepts valid)', () => {
      render(
        <ScheduleAppointmentPage
          doctor={sampleDoctor}
          initialStep={2}
          onBackToSearch={vi.fn()}
          onBackToHome={vi.fn()}
          onOpenLogin={vi.fn()}
          user={null}
        />
      );

      const emailInput = screen.getByLabelText(/Email address/i);

      // 1. Empty email: should NOT have error
      expect(screen.queryByText(/valid email address/i)).not.toBeInTheDocument();

      // 2. Invalid email format
      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
      const continueBtn = screen.getByRole('button', { name: /Review visit details/i });
      fireEvent.click(continueBtn);

      expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();

      // 3. Valid email format
      fireEvent.change(emailInput, { target: { value: 'priya.sharma@example.com' } });
      fireEvent.click(continueBtn);

      expect(screen.queryByText(/Enter a valid email address/i)).not.toBeInTheDocument();
    });
  });
});
