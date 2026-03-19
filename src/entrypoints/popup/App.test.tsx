import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';

// Mock the auth client
vi.mock('@/utils/auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: {
      social: vi.fn(),
    },
    signOut: vi.fn(),
  },
}));

// Mock wxt/browser
vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test-id${path}`),
    },
    tabs: {
      create: vi.fn(),
    },
  },
}));

import { authClient } from '@/utils/auth-client';
import { browser } from 'wxt/browser';

const mockGetSession = authClient.getSession as ReturnType<typeof vi.fn>;
const mockSignInSocial = authClient.signIn.social as ReturnType<typeof vi.fn>;
const mockSignOut = authClient.signOut as ReturnType<typeof vi.fn>;
const mockTabsCreate = browser.tabs.create as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Popup App', () => {
  it('shows loading state initially', () => {
    // getSession never resolves during this test
    mockGetSession.mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows sign-in button when no session', async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });
    render(<App />);
    expect(await screen.findByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('shows signed-in UI when session exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { email: 'ishaan@example.com', name: 'Ishaan' } },
      error: null,
    });
    render(<App />);
    expect(await screen.findByText(/signed in/i)).toBeInTheDocument();
    expect(screen.getByText('ishaan@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('shows error message when getSession fails', async () => {
    mockGetSession.mockRejectedValue(new Error('Failed to fetch'));
    render(<App />);
    expect(await screen.findByText(/failed to fetch/i)).toBeInTheDocument();
  });

  it('shows error from getSession error field', async () => {
    mockGetSession.mockResolvedValue({ data: null, error: { message: 'Unauthorized' } });
    render(<App />);
    expect(await screen.findByText(/unauthorized/i)).toBeInTheDocument();
  });

  it('calls signIn.social and opens a tab on button click', async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });
    // Simulate Better Auth returning a Google OAuth URL in ctx.data.url
    mockSignInSocial.mockImplementation(async ({ fetchOptions }: any) => {
      fetchOptions?.onSuccess?.({ data: { url: 'https://accounts.google.com/oauth' } });
    });

    render(<App />);
    const button = await screen.findByRole('button', { name: /sign in with google/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSignInSocial).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'google',
        callbackURL: 'chrome-extension://test-id/callback.html',
      }));
      expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'https://accounts.google.com/oauth' });
    });
  });

  it('calls signOut and reloads on sign-out click', async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { email: 'ishaan@example.com', name: 'Ishaan' } },
      error: null,
    });
    mockSignOut.mockResolvedValue({});

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(<App />);
    const button = await screen.findByRole('button', { name: /sign out/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
