import { createAuthClient } from 'better-auth/client';

import { getAppBaseUrl } from '@/utils/app-url';

export const authClient = createAuthClient({
  baseURL: getAppBaseUrl(),
});
