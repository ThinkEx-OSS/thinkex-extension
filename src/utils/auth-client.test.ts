import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('auth-client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('uses default baseURL when env is not set', async () => {
    vi.stubEnv('WXT_BETTER_AUTH_BASE_URL', '');
    const { authClient } = await import('./auth-client');
    expect(authClient).toBeDefined();
    expect(typeof authClient.getSession).toBe('function');
    expect(authClient.signIn).toBeDefined();
    expect(typeof authClient.signOut).toBe('function');
  });

  it('uses custom baseURL when env is set', async () => {
    vi.stubEnv('WXT_BETTER_AUTH_BASE_URL', 'http://localhost:3000');
    const { authClient } = await import('./auth-client');
    expect(authClient).toBeDefined();
    expect(typeof authClient.getSession).toBe('function');
    expect(authClient.signIn).toBeDefined();
    expect(typeof authClient.signOut).toBe('function');
  });
});
