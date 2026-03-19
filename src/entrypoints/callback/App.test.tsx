import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';

// Mock the auth client
vi.mock('@/utils/auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
  },
}));

import { authClient } from '@/utils/auth-client';

const mockGetSession = authClient.getSession as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset window.close mock between tests
  vi.spyOn(window, 'close').mockImplementation(() => {});
});

describe('Callback App', () => {
  it('shows loading state initially', () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText(/completing sign in/i)).toBeInTheDocument();
  });

  it('shows success message with display name when session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { name: 'Ishaan', email: 'ishaan@example.com' } },
      error: null,
    });
    render(<App />);
    expect(await screen.findByText(/successfully signed in as ishaan/i)).toBeInTheDocument();
    expect(screen.getByText(/you can close this tab/i)).toBeInTheDocument();
  });

  it('falls back to email when name is missing', async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { name: '', email: 'ishaan@example.com' } },
      error: null,
    });
    render(<App />);
    expect(await screen.findByText(/successfully signed in as ishaan@example.com/i)).toBeInTheDocument();
  });

  it('shows error message when getSession returns an error', async () => {
    mockGetSession.mockResolvedValue({
      data: null,
      error: { message: 'Token expired' },
    });
    render(<App />);
    expect(await screen.findByText(/sign in failed/i)).toBeInTheDocument();
    expect(screen.getByText(/token expired/i)).toBeInTheDocument();
  });

  it('shows error message when getSession throws', async () => {
    mockGetSession.mockRejectedValue(new Error('Network error'));
    render(<App />);
    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  it('shows empty state when no session and no error', async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });
    render(<App />);
    expect(await screen.findByText(/no session found/i)).toBeInTheDocument();
  });

  it('schedules window.close after success when window.opener is null', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    mockGetSession.mockResolvedValue({
      data: { user: { name: 'Ishaan', email: 'ishaan@example.com' } },
      error: null,
    });

    render(<App />);
    await screen.findByText(/successfully signed in as ishaan/i);

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    setTimeoutSpy.mockRestore();
  });
});
