import './style.css';
import { authClient } from '@/utils/auth-client';
import { browser } from 'wxt/browser';

type AuthState = 'loading' | 'signed-in' | 'signed-out' | 'error';

async function renderPopup() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '<p class="loading">Loading...</p>';

  const { data: session, error } = await authClient.getSession();

  if (error) {
    app.innerHTML = `
      <div class="auth-card">
        <p class="error">Error: ${error.message}</p>
      </div>
    `;
    return;
  }

  if (session) {
    app.innerHTML = `
      <div class="auth-card">
        <h2>Signed in</h2>
        <p class="user-email">${session.user.email ?? session.user.name ?? 'User'}</p>
        <button id="sign-out" type="button">Sign out</button>
      </div>
    `;
    document.getElementById('sign-out')?.addEventListener('click', async () => {
      await authClient.signOut();
      renderPopup();
    });
  } else {
    app.innerHTML = `
      <div class="auth-card">
        <h2>Thinkex</h2>
        <p class="auth-prompt">Sign in to continue</p>
        <button id="sign-in-google" type="button">Sign in with Google</button>
      </div>
    `;
    document.getElementById('sign-in-google')?.addEventListener('click', async () => {
      const callbackURL = browser.runtime.getURL('callback.html');
      await authClient.signIn.social({
        provider: 'google',
        callbackURL,
      });
    });
  }
}

renderPopup();
