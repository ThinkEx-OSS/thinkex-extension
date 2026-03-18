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
    const card = document.createElement('div');
    card.className = 'auth-card';
    const p = document.createElement('p');
    p.className = 'auth-error';
    p.textContent = `Error: ${error.message ?? 'Unknown error'}`;
    card.appendChild(p);
    container.replaceChildren(card);
    return;
  }

  if (session) {
    const rawName = session.user.name?.trim();
    const displayName = session.user.email ?? rawName ?? 'User';
    const card = document.createElement('div');
    card.className = 'auth-card';
    const h2 = document.createElement('h2');
    h2.textContent = 'Signed in';
    const p = document.createElement('p');
    p.className = 'auth-user-email';
    p.textContent = displayName;
    const btn = document.createElement('button');
    btn.id = 'sign-out';
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Sign out';
    card.append(h2, p, btn);
    container.replaceChildren(card);
    btn.addEventListener('click', () => {
      callbacks.onSignOut();
    });
  } else {
    const card = document.createElement('div');
    card.className = 'auth-card';
    const h2 = document.createElement('h2');
    h2.textContent = 'Thinkex';
    const p = document.createElement('p');
    p.className = 'auth-prompt';
    p.textContent = 'Sign in to continue';
    const btn = document.createElement('button');
    btn.id = 'sign-in-google';
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.textContent = 'Sign in with Google';
    card.append(h2, p, btn);
    container.replaceChildren(card);
    btn.addEventListener('click', () => {
      callbacks.onSignIn();
    });
  }
}
