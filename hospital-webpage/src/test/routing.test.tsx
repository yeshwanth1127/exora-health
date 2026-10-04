import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';

describe('App Routing, URL Synchronization & 404 Recovery', () => {

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Reset window.location
    window.history.replaceState({}, '', '/');
  });

  it('renders homepage by default when path is "/"', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);

    // Check for core landing page content
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('navigates to FAQ page via clean path "/faq"', async () => {
    window.history.replaceState({}, '', '/faq');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Frequently Asked Questions/i })).toBeInTheDocument();
    });
  });

  it('navigates to Departments overview via clean path "/departments"', async () => {
    window.history.replaceState({}, '', '/departments');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Clinical Departments|Departments/i)).toBeInTheDocument();
    });
  });

  it('navigates to specific department via clean path "/departments/cardiology"', async () => {
    window.history.replaceState({}, '', '/departments/cardiology');
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Cardiology/i).length).toBeGreaterThan(0);
    });
  });

  it('navigates to doctors directory via clean path "/doctors"', async () => {
    window.history.replaceState({}, '', '/doctors');
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Doctors|Find a Doctor/i).length).toBeGreaterThan(0);
    });
  });

  it('navigates to specific doctor detail via clean path "/doctors/doc-1"', async () => {
    window.history.replaceState({}, '', '/doctors/doc-1');
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Dr\. Ananditha/i).length).toBeGreaterThan(0);
    });
  });

  it('handles query parameter navigation "/?page=faq"', async () => {
    window.history.replaceState({}, '', '/?page=faq');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Frequently Asked Questions/i })).toBeInTheDocument();
    });
  });

  it('routes live-mode booking to backend with source and branch preserved', async () => {
    vi.stubEnv('VITE_BOOKING_MODE', 'live');
    try {
      window.history.replaceState({}, '', '/schedule?source=google_business&branch=indiranagar');
      render(<App />);
      await waitFor(() => expect(screen.getByRole('link', { name: /Continue to secure booking/i })).toHaveAttribute('href', '/book/?branch=indiranagar&source=google_business'));
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('defaults schedule appointment route to first doctor when none specified', async () => {
    window.history.replaceState({}, '', '/schedule?booking_preview=true');
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Dr\. Ananditha/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('safely falls back to default doctor if invalid doctor ID is provided in /schedule', async () => {
    window.history.replaceState({}, '', '/schedule/non-existent-doc-999?booking_preview=true');
    render(<App />);

    await waitFor(() => {
      // Should not crash and should fall back to valid doctor
      expect(screen.getAllByText(/Dr\. Ananditha/i).length).toBeGreaterThan(0);
    });
  });

  it('advances directly to Step 2 when query parameter step=2 is present', async () => {
    window.history.replaceState({}, '', '/?page=schedule&doctor=doc-1&step=2&booking_preview=true');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Patient Information/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Legal full name/i)).toBeInTheDocument();
    });
  });

  it('renders PageNotFound and allows recovery when navigating to an unrecognized route', async () => {
    window.history.replaceState({}, '', '/completely-unknown-route-1234');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Page not found/i)).toBeInTheDocument();
    });

    // Click "Back to home" button to recover
    const homeBtn = screen.getByRole('button', { name: /^Back to home$/i });
    fireEvent.click(homeBtn);

    // Verify recovery back to homepage
    await waitFor(() => {
      expect(screen.queryByText(/Page not found/i)).not.toBeInTheDocument();
    });
  });

  it('renders PageNotFound when requesting an invalid department ID', async () => {
    window.history.replaceState({}, '', '/departments/non-existent-department-xyz');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Page not found/i)).toBeInTheDocument();
    });
  });

  it('renders PageNotFound when requesting an invalid doctor detail ID', async () => {
    window.history.replaceState({}, '', '/doctors/non-existent-doctor-xyz');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Page not found/i)).toBeInTheDocument();
    });
  });

  it('responds to popstate browser navigation events', async () => {
    window.history.replaceState({}, '', '/faq');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Frequently Asked Questions/i })).toBeInTheDocument();
    });

    // Simulate browser back button to '/'
    window.history.replaceState({}, '', '/');
    fireEvent(window, new PopStateEvent('popstate'));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 1, name: /Frequently Asked Questions/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Find your hospital specialists/i)).toBeInTheDocument();
    });
  });

  it('offers the real patient portal instead of the sample sign-in', async () => {
    window.history.replaceState({}, '', '/');
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByText(/Sample sign-in only. No SMS is sent/)).toBeNull();
  });
});
