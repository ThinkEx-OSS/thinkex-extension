import { authClient } from '@/utils/auth-client';

const BASE_URL = import.meta.env.WXT_BETTER_AUTH_BASE_URL || 'http://localhost:3000';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {

    if (message.type === 'GET_SESSION') {
      authClient.getSession()
        .then(({ data }) => sendResponse({ session: data }))
        .catch(() => sendResponse({ session: null }));
      return true;
    }

    if (message.type === 'FETCH_WORKSPACES') {
      fetch(`${BASE_URL}/api/workspaces`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => sendResponse({ workspaces: data.workspaces ?? [] }))
        .catch(() => sendResponse({ workspaces: [] }));
      return true;
    }

    if (message.type === 'FETCH_WORKSPACE_EVENTS') {
      fetch(`${BASE_URL}/api/workspaces/${message.id}/events`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => sendResponse({ snapshot: data.snapshot ?? null }))
        .catch(() => sendResponse({ snapshot: null }));
      return true;
    }

  });
});
