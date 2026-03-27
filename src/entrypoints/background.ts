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

    if (message.type === 'GET_UPLOAD_URL') {
      fetch(`${BASE_URL}/api/upload-url`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: message.filename, contentType: message.contentType }),
      })
        .then((r) => r.json())
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err?.message ?? 'Unknown error' }));
      return true;
    }

if (message.type === 'CONVERT_TO_PDF') {
      fetch(`${BASE_URL}/api/office-conversion/convert-to-pdf`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: message.filePath, file_url: message.fileUrl }),
      })
        .then((r) => r.json())
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err?.message ?? 'Unknown error' }));
      return true;
    }

    if (message.type === 'IMPORT_FILES') {
      fetch(`${BASE_URL}/api/workspaces/${message.workspaceId}/import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: message.files }),
      })
        .then((r) => r.json())
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: err?.message ?? 'Unknown error' }));
      return true;
    }

  });
});
