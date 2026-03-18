import { describe, it, expect, beforeEach } from 'vitest';
import { renderCallbackResult } from './callback-ui';

describe('renderCallbackResult', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('shows error message when error is present', () => {
    renderCallbackResult(container, {
      session: null,
      error: new Error('Network failed'),
    });
    expect(container.innerHTML).toContain('Sign in failed: Network failed');
    expect(container.innerHTML).toContain('You can close this tab');
  });

  it('shows success with user name when session exists', () => {
    renderCallbackResult(container, {
      session: {
        user: { id: '1', name: 'Alice', email: 'alice@example.com' },
      },
      error: null,
    });
    expect(container.innerHTML).toContain('Successfully signed in as Alice!');
  });

  it('falls back to email when name is not set', () => {
    renderCallbackResult(container, {
      session: {
        user: { id: '1', email: 'bob@example.com' },
      },
      error: null,
    });
    expect(container.innerHTML).toContain('Successfully signed in as bob@example.com!');
  });

  it('shows no session message when session is null and no error', () => {
    renderCallbackResult(container, {
      session: null,
      error: null,
    });
    expect(container.innerHTML).toContain('No session found');
  });

  it('escapes HTML in user.name and does not execute script', () => {
    renderCallbackResult(container, {
      session: {
        user: {
          id: '1',
          name: '<script>alert(1)</script>',
          email: 'user@example.com',
        },
      },
      error: null,
    });
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('escapes HTML in error.message and does not execute handler', () => {
    renderCallbackResult(container, {
      session: null,
      error: new Error('<img src=x onerror=alert(1)>'),
    });
    // Raw <img tag must not appear (would be interpreted as HTML)
    expect(container.innerHTML).not.toContain('<img');
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
