import './style.css';
import { authClient } from '@/utils/auth-client';
import { browser } from 'wxt/browser';
import { renderAuthUI, type AuthError } from './auth-ui';

async function initPopup() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '<p class="loading">Loading...</p>';

  const { data: session, error } = await authClient.getSession();

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
