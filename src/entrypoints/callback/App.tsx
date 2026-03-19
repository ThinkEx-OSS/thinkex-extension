import { useState, useEffect } from 'react';
import { authClient } from '@/utils/auth-client';

export default function App() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'empty'>('loading');
    const [displayName, setDisplayName] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        authClient.getSession()
            .then(({ data, error }) => {
                if (error) { setErrorMsg(error.message ?? 'Unknown error'); setStatus('error'); return; }
                if (data?.user) {
                    setDisplayName(data.user.name?.trim() || data.user.email || 'User');
                    setStatus('success');
                    if (window.opener === null) setTimeout(() => window.close(), 2000);
                } else { setStatus('empty'); }
            })
            .catch((err) => { setErrorMsg(err?.message ?? 'Unknown error'); setStatus('error'); });
    }, []);

    if (status === 'loading') return <p>Completing sign in...</p>;
    if (status === 'error') return (
        <div>
            <p className="text-red-500">Sign in failed: {errorMsg}</p>
            <p>You can close this tab.</p>
        </div>
    );
    if (status === 'success') return (
        <div>
            <p className="text-green-500 font-semibold">Successfully signed in as {displayName}!</p>
            <p className="text-gray-400">You can close this tab and open the extension popup.</p>
        </div>
    );
    return <p>No session found. You can close this tab.</p>;
}
