import { authClient } from '@/utils/auth-client';

const app = document.querySelector<HTMLDivElement>('#app')!;

authClient.getSession().then(({ data, error }) => {
  if (error) {
    app.innerHTML = `
      <p style="color: #ef4444;">Sign in failed: ${error.message}</p>
      <p>You can close this tab.</p>
    `;
  } else if (data?.user) {
    app.innerHTML = `
      <p style="color: #22c55e; font-weight: 600;">Successfully signed in as ${data.user.name ?? data.user.email}!</p>
      <p style="color: #888;">You can close this tab and open the extension popup.</p>
    `;
    // If we were opened in a new tab, offer to close
    if (window.opener === null && !window.location.hash.includes('popup')) {
      setTimeout(() => {
        window.close();
      }, 2000);
    }
  } else {
    app.innerHTML = '<p>No session found. You can close this tab.</p>';
  }
});
