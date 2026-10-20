import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DepartmentPage } from '../components/departments/DepartmentPage';
import { DoctorDetailPage } from '../components/doctor/DoctorDetailPage';
import { PageErrorBoundary } from '../components/common/PageStates';

describe('Frontend Data Resilience & Crash-Proofing', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('DepartmentPage Resilience with Missing Fields & Empty Slides', () => {
    it('renders gracefully when symptom slides and department info are incomplete', () => {
      render(
        <DepartmentPage
          departmentId="nonexistent-department-xyz"
          onBackToHome={vi.fn()}
          onBackToDepartments={vi.fn()}
          onSelectDepartment={vi.fn()}
          onViewDoctor={vi.fn()}
          onBookDoctor={vi.fn()}
          onOpenBooking={vi.fn()}
        />
      );

      // Verify breadcrumbs and primary sections render with safe fallbacks
      expect(screen.getAllByText(/Gynecology|Clinical Care|Specialties/i).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /Book appointment/i }).length).toBeGreaterThan(0);
    });
  });

  describe('DoctorDetailPage Resilience with Incomplete Profile Data', () => {
    it('renders gracefully when doctor is not found and falls back to default profile', () => {
      render(
        <DoctorDetailPage
          doctorId="invalid-doctor-id-9999"
          onBackToSearch={vi.fn()}
          onBackToHome={vi.fn()}
          onScheduleAppointment={vi.fn()}
        />
      );

      // Doctor's name or fallback profile should appear without throwing
      expect(screen.getByRole('button', { name: /Schedule Appointment/i })).toBeInTheDocument();
    });
  });

  describe('PageErrorBoundary Error Trapping and Recovery', () => {
    it('catches runtime component crash and recovers cleanly when user clicks retry', () => {
      let shouldThrow = true;
      function BuggyComponent() {
        if (shouldThrow) {
          throw new Error('Simulated UI crash in clinical component');
        }
        return <div>Recovered Component Successfully</div>;
      }

      // Suppress expected console.error during boundary test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { rerender } = render(
        <PageErrorBoundary onGoHome={vi.fn()}>
          <BuggyComponent />
        </PageErrorBoundary>
      );

      // Should display the graceful failure UI
      expect(screen.getByText('This page couldn’t load')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();

      // Repair the underlying condition and click retry
      shouldThrow = false;
      fireEvent.click(screen.getByRole('button', { name: /Try again/i }));

      rerender(
        <PageErrorBoundary onGoHome={vi.fn()}>
          <BuggyComponent />
        </PageErrorBoundary>
      );

      // Should successfully render the recovered component
      expect(screen.getByText('Recovered Component Successfully')).toBeInTheDocument();
      spy.mockRestore();
    });
  });
});
