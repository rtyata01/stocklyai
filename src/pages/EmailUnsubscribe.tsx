import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { emailRequest, readEmailPreference, saveEmailPreference } from '@/lib/emailPreferences';
import { z } from 'zod';

export default function EmailUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'ready' | 'done' | 'invalid'>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!z.string().uuid().safeParse(token).success) { setState('invalid'); return; }
    emailRequest({ action: 'unsubscribe-status', token }).then(() => setState('ready')).catch(() => setState('invalid'));
  }, [token]);
  const unsubscribe = async () => {
    setBusy(true); setError('');
    try {
      await emailRequest({ action: 'unsubscribe', token }); setState('done');
      const pref = readEmailPreference(); if (pref?.token === token) saveEmailPreference({ ...pref, subscribed: false });
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"><div className="max-w-md space-y-4"><h1 className="text-2xl font-bold">STOCKLYAI</h1><h2 className="text-lg">Email preferences</h2>{state === 'loading' && <div className="h-16 animate-pulse bg-muted" />}{state === 'ready' && <><p className="text-sm text-muted-foreground">Unsubscribe from Monday debriefs and stop all active price alerts?</p><Button onClick={unsubscribe} disabled={busy}>Unsubscribe</Button></>}{state === 'done' && <p role="status">You're unsubscribed. Your active email alerts have been removed.</p>}{state === 'invalid' && <p>This unsubscribe link is invalid. Open the link from your latest email.</p>}{error && <p role="alert" className="text-destructive">{error}</p>}<Link className="block text-sm text-primary" to="/">Back to Portfolio</Link></div></main>;
}