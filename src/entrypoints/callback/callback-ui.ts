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
    const p1 = document.createElement('p');
    p1.style.color = '#ef4444';
    p1.textContent = `Sign in failed: ${error.message ?? 'Unknown error'}`;
    const p2 = document.createElement('p');
    p2.textContent = 'You can close this tab.';
    container.replaceChildren(p1, p2);
    return;
  }

  if (session?.user) {
    const rawName = session.user.name?.trim();
    const displayName = rawName || session.user.email || 'User';
    const p1 = document.createElement('p');
    p1.style.color = '#22c55e';
    p1.style.fontWeight = '600';
    p1.textContent = `Successfully signed in as ${displayName}!`;
    const p2 = document.createElement('p');
    p2.style.color = '#888';
    p2.textContent = 'You can close this tab and open the extension popup.';
    container.replaceChildren(p1, p2);
  } else {
    const p = document.createElement('p');
    p.textContent = 'No session found. You can close this tab.';
    container.replaceChildren(p);
  }
}
