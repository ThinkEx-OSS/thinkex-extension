/**
 * Callback page render logic - extracted for testability.
 */

export interface CallbackSessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

export interface CallbackSession {
  user: CallbackSessionUser;
}

/** Better Auth and other API errors - have message, may not be Error instance */
export type CallbackError = { message?: string } | null;

export function renderCallbackResult(
  container: HTMLElement,
  state: { session: CallbackSession | null; error: CallbackError },
  _options?: { autoCloseDelayMs?: number },
): void {
  const { session, error } = state;

  if (error) {
    container.innerHTML = `
      <p style="color: #ef4444;">Sign in failed: ${error.message ?? 'Unknown error'}</p>
      <p>You can close this tab.</p>
    `;
    return;
  }

  if (session?.user) {
    const displayName = session.user.name ?? session.user.email ?? 'User';
    container.innerHTML = `
      <p style="color: #22c55e; font-weight: 600;">Successfully signed in as ${displayName}!</p>
      <p style="color: #888;">You can close this tab and open the extension popup.</p>
    `;
  } else {
    container.innerHTML = '<p>No session found. You can close this tab.</p>';
  }
}
