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

    if (message.type === 'SIGN_IN_SOCIAL') {
      let redirectUrl: string | null = null;
      authClient.signIn.social({
        provider: 'google',
        callbackURL: message.callbackURL,
        fetchOptions: {
          onSuccess: (ctx: any) => { redirectUrl = ctx.data?.url ?? null; },
        },
      })
        .then(() => sendResponse({ url: redirectUrl }))
        .catch(() => sendResponse({ url: null }));
      return true;
    }

    if (message.type === 'FETCH_WORKSPACES') {
      fetch(`${BASE_URL}/api/workspaces`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => sendResponse({ workspaces: data.workspaces ?? [] }))
        .catch(() => sendResponse({ workspaces: [] }));
      return true;
    }

    if (message.type === 'FETCH_WORKSPACE_FOLDERS') {
      fetch(`${BASE_URL}/api/workspaces/${message.id}/folders`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => sendResponse({ folders: data.folders ?? [] }))
        .catch(() => sendResponse({ folders: [] }));
      return true;
    }

  });
});
