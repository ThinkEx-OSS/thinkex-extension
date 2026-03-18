import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderAuthUI } from './auth-ui';

describe('renderAuthUI', () => {
  let container: HTMLElement;
  const mockCallbacks = {
    onSignIn: vi.fn().mockResolvedValue(undefined),
    onSignOut: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.innerHTML = '';
    document.body.appendChild(container);
    mockCallbacks.onSignIn.mockClear();
    mockCallbacks.onSignOut.mockClear();
  });

  it('renders error state when error is present', () => {
    renderAuthUI(container, { session: null, error: new Error('Network failed') }, mockCallbacks);

    expect(container.querySelector('.auth-error')?.textContent).toBe('Error: Network failed');
    expect(container.querySelector('#sign-in-google')).toBeNull();
    expect(container.querySelector('#sign-out')).toBeNull();
  });

  it('renders signed-in state with user email', () => {
    renderAuthUI(
      container,
      {
        session: { user: { id: '1', email: 'alice@example.com', name: 'Alice' } },
        error: null,
      },
      mockCallbacks,
    );

    expect(container.querySelector('.auth-user-email')?.textContent).toBe('alice@example.com');
    expect(container.querySelector('#sign-out')).not.toBeNull();
    expect(container.querySelector('#sign-in-google')).toBeNull();
  });

  it('renders signed-in state with user name when email is missing', () => {
    renderAuthUI(
      container,
      {
        session: { user: { id: '1', name: 'Bob', email: null } },
        error: null,
      },
      mockCallbacks,
    );

    expect(container.querySelector('.auth-user-email')?.textContent).toBe('Bob');
  });

  it('calls onSignOut when sign out button is clicked', async () => {
    renderAuthUI(
      container,
      {
        session: { user: { id: '1', email: 'test@test.com' } },
        error: null,
      },
      mockCallbacks,
    );

    const signOutBtn = container.querySelector<HTMLButtonElement>('#sign-out');
    expect(signOutBtn).not.toBeNull();
    signOutBtn!.click();

    expect(mockCallbacks.onSignOut).toHaveBeenCalledTimes(1);
  });

  it('renders signed-out state with sign in button', () => {
    renderAuthUI(container, { session: null, error: null }, mockCallbacks);

    expect(container.querySelector('#sign-in-google')?.textContent).toBe('Sign in with Google');
    expect(container.querySelector('.auth-prompt')?.textContent).toBe('Sign in to continue');
    expect(container.querySelector('#sign-out')).toBeNull();
  });

  it('calls onSignIn when sign in button is clicked', () => {
    renderAuthUI(container, { session: null, error: null }, mockCallbacks);

    const signInBtn = container.querySelector<HTMLButtonElement>('#sign-in-google');
    expect(signInBtn).not.toBeNull();
    signInBtn!.click();

    expect(mockCallbacks.onSignIn).toHaveBeenCalledTimes(1);
  });
});
