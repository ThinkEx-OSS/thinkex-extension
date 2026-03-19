import { useState, useEffect } from 'react';
import { authClient } from '@/utils/auth-client';
import { browser } from 'wxt/browser';

const BANNER_KEY = 'banner_enabled';

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.09-6.09C34.46 3.19 29.53 1 24 1 14.82 1 7.07 6.48 3.64 14.18l7.09 5.51C12.44 13.61 17.76 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.96-2.2 5.47-4.68 7.15l7.18 5.57C43.35 37.28 46.52 31.36 46.52 24.5z"/>
            <path fill="#FBBC05" d="M10.73 28.31A14.6 14.6 0 0 1 9.5 24c0-1.49.26-2.93.73-4.31l-7.09-5.51A23.93 23.93 0 0 0 0 24c0 3.86.92 7.51 2.54 10.73l8.19-6.42z"/>
            <path fill="#34A853" d="M24 47c5.53 0 10.17-1.83 13.56-4.97l-7.18-5.57C28.6 37.92 26.43 38.5 24 38.5c-6.24 0-11.56-4.11-13.27-9.69l-8.19 6.42C6.07 43.52 14.45 47 24 47z"/>
        </svg>
    );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <div onClick={onToggle} style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            background: on ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.15)',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
        }}>
            <div style={{
                position: 'absolute',
                top: 3,
                left: on ? 19 : 3,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: on ? '#111' : 'rgba(255,255,255,0.5)',
                transition: 'left 0.2s, background 0.2s',
            }} />
        </div>
    );
}

export default function App() {
    const [session, setSession] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [bannerOn, setBannerOn] = useState(true);

    useEffect(() => {
        authClient.getSession()
            .then(({ data, error }) => {
                setSession(data);
                if (error) setError(error.message ?? 'Unknown error');
            })
            .catch((err) => setError(err?.message ?? 'Unknown error'))
            .finally(() => setLoading(false));

        browser.storage.sync.get(BANNER_KEY).then((result) => {
            setBannerOn(result[BANNER_KEY] !== false);
        });
    }, []);

    function toggleBanner() {
        const next = !bannerOn;
        setBannerOn(next);
        browser.storage.sync.set({ [BANNER_KEY]: next });
    }

    if (loading) return (
        <div style={styles.root}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading...</p>
        </div>
    );

    if (error) return (
        <div style={styles.root}>
            <p style={{ color: '#f87171', fontSize: 13 }}>Error: {error}</p>
        </div>
    );

    if (session) return (
        <div style={styles.root}>
            <img src="/ThinkExLogo.svg" width={36} height={36} style={{ marginBottom: 4 }} />
            <p style={styles.email}>{session.user.email ?? 'Signed in'}</p>

            <div style={styles.divider} />

            <div style={styles.row}>
                <span style={styles.label}>Canvas banner</span>
                <Toggle on={bannerOn} onToggle={toggleBanner} />
            </div>

            <div style={styles.divider} />

            <button
                style={styles.signOut}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                onClick={() => authClient.signOut().then(() => window.location.reload())}
            >
                Sign out
            </button>
        </div>
    );

    return (
        <div style={styles.root}>
            <img src="/ThinkExLogo.svg" width={40} height={40} style={{ marginBottom: 10 }} />
            <p style={styles.subtext}>Sign in to use the extension</p>
            <button
                style={styles.button}
                onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1e1e1e')}
                onClick={async () => {
                    await authClient.signIn.social({
                        provider: 'google',
                        callbackURL: browser.runtime.getURL('/callback.html'),
                        fetchOptions: {
                            onSuccess: (ctx) => {
                                const url = ctx.data?.url;
                                if (url) browser.tabs.create({ url });
                            },
                        },
                    });
                }}
            >
                <GoogleIcon />
                Continue with Google
            </button>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        width: 240,
        background: '#111',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 20px',
        boxSizing: 'border-box',
        gap: 10,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    email: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        margin: 0,
        textAlign: 'center',
        wordBreak: 'break-all',
    },
    divider: {
        width: '100%',
        height: 1,
        background: 'rgba(255,255,255,0.07)',
    },
    row: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    label: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
    },
    signOut: {
        background: 'none',
        border: 'none',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
        cursor: 'pointer',
        padding: 0,
        transition: 'color 0.15s',
    },
    subtext: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12.5,
        margin: '0 0 8px',
        textAlign: 'center',
    },
    button: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: '#1e1e1e',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        padding: '10px 14px',
        fontSize: 13.5,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.15s',
    },
};
