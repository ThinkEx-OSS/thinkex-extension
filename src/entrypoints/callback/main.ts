import { authClient } from '@/utils/auth-client';
import { renderCallbackResult, type CallbackError } from './callback-ui';

const app = document.querySelector<HTMLDivElement>('#app')!;

authClient.getSession().then(({ data, error }) => {
  renderCallbackResult(app, { session: data, error: (error ?? null) as CallbackError });
  if (data?.user && window.opener === null && !window.location.hash.includes('popup')) {
    setTimeout(() => window.close(), 2000);
  }
});
