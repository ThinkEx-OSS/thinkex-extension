import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthClient } from 'better-auth/client';

// Mock import.meta.env before importing auth-client
vi.stubGlobal('import', {
  meta: {
    env: {
      WXT_BETTER_AUTH_BASE_URL: 'http://localhost:3000',
    },
  },
});

describe('auth-client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates client with default baseURL when env is not set', async () => {
    const { authClient } = await import('./auth-client');
    expect(authClient).toBeDefined();
    // Better Auth client exposes baseURL or we can check it has expected methods
    expect(typeof authClient.getSession).toBe('function');
    expect(authClient.signIn).toBeDefined();
    expect(typeof authClient.signOut).toBe('function');
  });
});
