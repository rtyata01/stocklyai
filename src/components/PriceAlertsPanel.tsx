import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useUserWatchlists } from '@/hooks/useUserWatchlists';
import { alertSchema, emailSchema, emailRequest, readEmailPreference, saveEmailPreference, PriceAlert } from '@/lib/emailPreferences';
import { Bell, Loader2, Trash2 } from 'lucide-react';

export default function PriceAlertsPanel() {
  const { sectors } = usePortfolio();
  const { lists } = useUserWatchlists();
  const tickers = [...new Set([...sectors.flatMap(s => s.tickers), ...lists.flatMap(l => l.tickers)])].sort();
  const [ticker, setTicker] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [email, setEmail] = useState(() => readEmailPreference()?.email ?? '');
  const [hasEmail, setHasEmail] = useState(() => Boolean(readEmailPreference()));
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!ticker && tickers[0]) setTicker(tickers[0]);
  }, [ticker, tickers.join(',')]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const pref = readEmailPreference(); if (!pref) return;
      setHasEmail(true); setEmail(pref.email); setLoading(true);
      try {
        const res = await emailRequest({ action: 'list', token: pref.token });
        if (!cancelled) { setAlerts(res.alerts ?? []); if (!res.deliveryReady) setNotice('Email delivery is pending sender verification.'); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load alerts.'); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load(); window.addEventListener('stockly-email-updated', load);
    return () => { cancelled = true; window.removeEventListener('stockly-email-updated', load); };
  }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    const parsed = alertSchema.safeParse({ ticker, direction, price: Number(price) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check your alert.'); return; }
    const pref = readEmailPreference();
    const address = emailSchema.safeParse(email);
    if (!pref && !address.success) { setError('Enter a valid email address for this alert.'); return; }
    setBusy(true);
    try {
      const res = await emailRequest({ action: 'save-alert', ...parsed.data, ...(pref ? { token: pref.token } : { email: address.success ? address.data : email }) });
      setAlerts(res.alerts ?? []); setPrice(''); setHasEmail(true);
      saveEmailPreference({ token: res.token, email: res.email, subscribed: res.subscribed });
      setNotice(res.deliveryReady ? 'Alert saved.' : 'Alert saved. Email delivery is pending sender verification.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save alert.'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    const pref = readEmailPreference(); if (!pref) return;
    setBusy(true); setError('');
    try { const res = await emailRequest({ action: 'delete-alert', token: pref.token, id }); setAlerts(res.alerts ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete alert.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-b border-border pb-5">
    <h3 className="flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4 text-primary" />Price alerts</h3>
    <form onSubmit={save} className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={ticker} onValueChange={setTicker}><SelectTrigger aria-label="Alert ticker" className="w-36"><SelectValue placeholder="Ticker" /></SelectTrigger><SelectContent>{tickers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Tabs value={direction} onValueChange={v => setDirection(v === 'below' ? 'below' : 'above')}><TabsList><TabsTrigger value="above">Above</TabsTrigger><TabsTrigger value="below">Below</TabsTrigger></TabsList></Tabs>
        <Input type="number" aria-label="Alert price in USD" placeholder="$ Price" min="0.01" max="10000000" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} className="w-36" />
        <Button type="submit" disabled={busy || !ticker}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save</Button>
      </div>
      {!hasEmail && <div className="max-w-md space-y-1"><label htmlFor="alert-email" className="text-xs text-muted-foreground">Email for triggered alerts</label><Input id="alert-email" type="email" required maxLength={255} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>}
    </form>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
    <div className="divide-y divide-border">
      {loading && <div className="h-10 animate-pulse bg-muted rounded-sm" />}
      {!loading && !alerts.length && <p className="py-3 text-xs text-muted-foreground">No active price alerts.</p>}
      {alerts.map(a => <div key={a.id} className="flex items-center gap-3 py-2 text-sm"><span className="font-mono font-medium w-20">{a.ticker}</span><span className="flex-1">Crosses {a.direction} ${Number(a.target_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}{a.triggered_at && <span className="ml-2 text-xs text-muted-foreground">Email pending</span>}</span><Button variant="ghost" size="icon" aria-label={`Delete ${a.ticker} alert`} title="Delete alert" disabled={busy} onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button></div>)}
    </div>
  </section>;
}