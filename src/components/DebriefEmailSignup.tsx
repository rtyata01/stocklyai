import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emailRequest, emailSchema, readEmailPreference, saveEmailPreference } from '@/lib/emailPreferences';
import { Check, Loader2 } from 'lucide-react';

export default function DebriefEmailSignup({ tickers, label }: { tickers: string[]; label: string }) {
  const [email, setEmail] = useState(() => readEmailPreference()?.email ?? '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(true);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Enter a valid email.'); return; }
    setBusy(true);
    try {
      const prior = readEmailPreference();
      const res = await emailRequest({ action: 'subscribe', email: parsed.data, tickers: [...new Set(tickers)], label, ...(prior?.email === parsed.data ? { token: prior.token } : {}) });
      saveEmailPreference({ token: res.token, email: res.email, subscribed: true });
      setReady(res.deliveryReady); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not subscribe.'); }
    finally { setBusy(false); }
  };
  return <section className="border-t border-border pt-4">
    {saved ? <div role="status" className="space-y-1"><p className="flex gap-2 items-center text-sm"><Check className="h-4 w-4 text-pine" />You're in — see you Monday</p>{!ready && <p className="text-xs text-muted-foreground">Subscription saved. Email delivery starts after the site's sender is verified.</p>}</div> :
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="debrief-email" className="text-sm font-medium">Get this debrief in your inbox every Monday</label>
        <div className="flex gap-2 flex-wrap"><Input id="debrief-email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={255} required value={email} onChange={e => setEmail(e.target.value)} className="flex-1 min-w-48" /><Button type="submit" disabled={busy || !tickers.length}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Subscribe</Button></div>
      </form>}
    {error && <p role="alert" className="text-xs text-destructive mt-2">{error}</p>}
  </section>;
}