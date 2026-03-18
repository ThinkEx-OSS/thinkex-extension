import './style.css';
import { authClient } from '@/utils/auth-client';
import { browser } from 'wxt/browser';
import { renderAuthUI, type AuthError } from './auth-ui';

async function initPopup() {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    console.error('Popup: #app element not found');
    return;
  }
  const loading = document.createElement('p');
  loading.className = 'auth-loading';
  loading.textContent = 'Loading...';
  app.replaceChildren(loading);

  let session: Awaited<ReturnType<typeof authClient.getSession>>['data'];
  let error: Awaited<ReturnType<typeof authClient.getSession>>['error'];
  try {
    const result = await authClient.getSession();
    session = result.data;
    error = result.error;
  } catch (err) {
    session = null;
    error = { message: (err as Error)?.message ?? 'Unknown error' };
  }

  renderAuthUI(app, { session, error: (error ?? null) as AuthError }, {
    onSignIn: async () => {
      const callbackURL = browser.runtime.getURL('/callback.html');
      await authClient.signIn.social({
        provider: 'google',
        callbackURL,
      });
    },
    onSignOut: async () => {
      await authClient.signOut();
      initPopup();
    },
  });
}

initPopup();
