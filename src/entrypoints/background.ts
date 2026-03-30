import { authClient } from '@/utils/auth-client';

const BASE_URL = import.meta.env.WXT_BETTER_AUTH_BASE_URL || 'http://localhost:3000';

// Cache TTL: 5 minutes. Stale data is returned instantly; fresh fetch happens only when expired.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// In-memory cache — fastest path, but lost when the MV3 service worker is terminated.
const memCache: {
  workspaces: CacheEntry<any[]> | null;
  folders: Record<string, CacheEntry<any[]>>;
} = { workspaces: null, folders: {} };

function isFresh(entry: CacheEntry<any> | null | undefined): boolean {
  return !!entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

async function readSession<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const result = await browser.storage.session.get(key);
    return (result[key] as CacheEntry<T>) ?? null;
  } catch {
    return null;
  }
}

function writeSession<T>(key: string, entry: CacheEntry<T>): void {
  browser.storage.session.set({ [key]: entry }).catch(() => {});
}

async function parseResponsePayload(r: Response): Promise<unknown> {
  const contentType = r.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return await r.json();
  }

  const text = await r.text();
  return text || null;
}

function getResponseError(payload: unknown, status: number, statusText: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload;

  if (payload && typeof payload === 'object') {
    const candidate = (payload as Record<string, unknown>).error
      ?? (payload as Record<string, unknown>).message;
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }

  return `Request failed (${status} ${statusText})`;
}

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
      (async () => {
        // 1. In-memory cache — instant if worker hasn't been terminated
        if (isFresh(memCache.workspaces)) {
          sendResponse({ workspaces: memCache.workspaces!.data });
          return;
        }
        // 2. Session storage — survives worker restarts within the same browser session
        const stored = await readSession<any[]>('workspaces_cache');
        if (isFresh(stored)) {
          memCache.workspaces = stored!;
          sendResponse({ workspaces: stored!.data });
          return;
        }
        // 3. Network fetch — cache the result for subsequent opens
        try {
          const r = await fetch(`${BASE_URL}/api/workspaces`, { credentials: 'include' });
          const data = await r.json();
          const entry: CacheEntry<any[]> = { data: data.workspaces ?? [], fetchedAt: Date.now() };
          memCache.workspaces = entry;
          writeSession('workspaces_cache', entry);
          sendResponse({ workspaces: entry.data });
        } catch {
          sendResponse({ workspaces: [] });
        }
      })();
      return true;
    }

    if (message.type === 'FETCH_WORKSPACE_FOLDERS') {
      const wsId: string = message.id;
      (async () => {
        // 1. In-memory cache
        if (isFresh(memCache.folders[wsId])) {
          sendResponse({ folders: memCache.folders[wsId].data });
          return;
        }
        // 2. Session storage
        const stored = await readSession<any[]>(`folders_cache_${wsId}`);
        if (isFresh(stored)) {
          memCache.folders[wsId] = stored!;
          sendResponse({ folders: stored!.data });
          return;
        }
        // 3. Network fetch
        try {
          const r = await fetch(`${BASE_URL}/api/workspaces/${wsId}/folders`, { credentials: 'include' });
          const data = await r.json();
          const entry: CacheEntry<any[]> = { data: data.folders ?? [], fetchedAt: Date.now() };
          memCache.folders[wsId] = entry;
          writeSession(`folders_cache_${wsId}`, entry);
          sendResponse({ folders: entry.data });
        } catch {
          sendResponse({ folders: [] });
        }
      })();
      return true;
    }

    if (message.type === 'GET_UPLOAD_URL') {
      fetch(`${BASE_URL}/api/upload-url`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: message.filename, contentType: message.contentType }),
      })
        .then(async (r) => {
          const payload = await parseResponsePayload(r);
          if (!r.ok) {
            sendResponse({ ok: false, error: getResponseError(payload, r.status, r.statusText), data: payload });
            return;
          }
          sendResponse({ ok: true, data: payload });
        })
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
        .then(async (r) => {
          const payload = await parseResponsePayload(r);
          if (!r.ok) {
            sendResponse({ ok: false, error: getResponseError(payload, r.status, r.statusText), data: payload });
            return;
          }
          sendResponse({ ok: true, data: payload });
        })
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
        .then(async (r) => {
          const payload = await parseResponsePayload(r);
          if (!r.ok) {
            sendResponse({ ok: false, error: getResponseError(payload, r.status, r.statusText), data: payload });
            return;
          }
          sendResponse({ ok: true, data: payload });
        })
        .catch((err) => sendResponse({ ok: false, error: err?.message ?? 'Unknown error' }));
      return true;
    }

  });
});
