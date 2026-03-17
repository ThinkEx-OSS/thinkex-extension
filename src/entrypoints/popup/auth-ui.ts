/**
 * Auth UI rendering logic - extracted for testability.
 * Renders the appropriate state and wires up event handlers.
 */

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

export interface Session {
  user: SessionUser;
}

export interface AuthUICallbacks {
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

/** Better Auth and other API errors - have message, may not be Error instance */
export type AuthError = { message?: string } | null;

export function renderAuthUI(
  container: HTMLElement,
  state: { session: Session | null; error: AuthError },
  callbacks: AuthUICallbacks,
): void {
  const { session, error } = state;

  if (error) {
    container.innerHTML = `
      <div class="auth-card">
        <p class="error">Error: ${error.message ?? 'Unknown error'}</p>
      </div>
    `;
    return;
  }

  if (session) {
    const displayName = session.user.email ?? session.user.name ?? 'User';
    container.innerHTML = `
      <div class="auth-card">
        <h2>Signed in</h2>
        <p class="user-email">${displayName}</p>
        <button id="sign-out" type="button">Sign out</button>
      </div>
    `;
    document.getElementById('sign-out')?.addEventListener('click', () => {
      callbacks.onSignOut();
    });
  } else {
    container.innerHTML = `
      <div class="auth-card">
        <h2>Thinkex</h2>
        <p class="auth-prompt">Sign in to continue</p>
        <button id="sign-in-google" type="button">Sign in with Google</button>
      </div>
    `;
    document.getElementById('sign-in-google')?.addEventListener('click', () => {
      callbacks.onSignIn();
    });
  }
}
