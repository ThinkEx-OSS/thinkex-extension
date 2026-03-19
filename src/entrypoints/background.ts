import { authClient } from '@/utils/auth-client';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_SESSION') {
      authClient.getSession()
        .then(({ data }) => sendResponse({ session: data }))
        .catch(() => sendResponse({ session: null }));
      return true; // keep message channel open for async response
    }
  });
});
