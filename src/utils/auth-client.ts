import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: import.meta.env.WXT_BETTER_AUTH_BASE_URL || 'http://localhost:3000',
});
