import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { escapeHtml, marketPrice } from '../_shared/emailRules.ts';
import { crosses } from '../_shared/priceCrossing.ts';
import { deliveryReady, sendEmail } from '../_shared/resendDelivery.ts';

const schema = z.object({ job: z.enum(['alerts', 'digest']), callbackToken: z.string().uuid().optional() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
  let claimed = false;
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid job.' }, 400);
    const { job, callbackToken } = parsed.data;
    const bearer = req.headers.get('authorization')?.replace(/^Bearer /, '');
    const { data: config, error: configError } = await db.from('email_job_config').select('callback_token').eq('id', true).maybeSingle();
    if (configError) throw configError;
    if (!(serviceKey && bearer === serviceKey) && !(callbackToken && config?.callback_token === callbackToken)) return json({ error: 'Unauthorized.' }, 401);
    if (!deliveryReady()) return json({ skipped: 'Verified sender not configured.' });
    const { data: lock, error: lockError } = await db.rpc('claim_stock_email_job', { job_name: job });
    if (lockError) throw lockError;
    if (!lock) return json({ skipped: 'Job already running.' });
    claimed = true;
    let sent = 0;
    let failed = 0;
    const now = new Date();
    if (job === 'digest') {
      if (now.getUTCDay() !== 1) return json({ skipped: 'Monday digest runs on Mondays.' });
      const date = now.toISOString().slice(0, 10);
      const { data: subscriptions, error } = await db.from('email_subscriptions').select('*').eq('subscribed', true).or(`last_digest_date.is.null,last_digest_date.lt.${date}`).limit(10);
      if (error) throw error;
      for (const sub of subscriptions ?? []) {
        if (!sub.tickers?.length) continue;
        try {
          const { data: briefing, error: briefingError } = await db.functions.invoke('portfolio-briefing', { body: { tickers: sub.tickers } });
          if (briefingError || briefing?.error || !briefing?.executiveSummary) throw new Error('Briefing unavailable');
          const bullets = (values: unknown[]) => `<ul>${values.map(v => `<li>${escapeHtml(v)}</li>`).join('')}</ul>`;
          const html = `<h2>The Weekly Debrief — ${escapeHtml(sub.label)}</h2><p>${escapeHtml(briefing.executiveSummary)}</p><p>Weekly return: ${escapeHtml(briefing.portfolioWeekPct)}% · SPY: ${escapeHtml(briefing.spyWeekPct)}% · Alpha: ${escapeHtml(briefing.alphaPct)}%</p><h3>What moved the needle</h3>${bullets(briefing.driverBullets ?? [])}<h3>Risks on the radar</h3>${bullets(briefing.risks ?? [])}<h3>Opportunities ahead</h3>${bullets(briefing.opportunities ?? [])}<h3>Upcoming earnings and dividends</h3>${bullets((briefing.upcoming ?? []).map((e: any) => `${e.ticker}: ${e.earningsDate ? `Earnings ${e.earningsDate}` : ''} ${e.dividendDate ? `Dividend ${e.dividendDate}` : ''}`))}`;
          await sendEmail(sub.email, `Your Monday Weekly Debrief — ${sub.label}`, html, sub.management_token, `debrief-${sub.id}-${date}`);
          const { error: updateError } = await db.from('email_subscriptions').update({ last_digest_date: date }).eq('id', sub.id);
          if (updateError) throw updateError;
          sent++;
        } catch (e) { failed++; console.error('Digest delivery failed', e instanceof Error ? e.message : 'unknown'); }
      }
    } else {
      const { data: alerts, error } = await db.from('price_alerts').select('*,email_subscriptions!inner(email,management_token)').is('delivered_at', null).order('created_at', { ascending: true }).limit(200);
      if (error) throw error;
      const prices = new Map<string, number | null>();
      for (const ticker of [...new Set((alerts ?? []).map(a => a.ticker))]) prices.set(ticker, await marketPrice(ticker));
      for (const alert of alerts ?? []) {
        try {
          const price = prices.get(alert.ticker);
          let triggered = Boolean(alert.triggered_at);
          if (price != null && !triggered) {
            triggered = crosses(alert.last_price == null ? null : Number(alert.last_price), price, Number(alert.target_price), alert.direction);
            const { error: updateError } = await db.from('price_alerts').update({ last_price: price, ...(triggered ? { triggered_at: now.toISOString() } : {}) }).eq('id', alert.id);
            if (updateError) throw updateError;
          }
          if (!triggered) continue;
          const sub = alert.email_subscriptions;
          await sendEmail(sub.email, `${alert.ticker} crossed ${alert.direction} $${alert.target_price}`, `<h2>Price alert: ${escapeHtml(alert.ticker)}</h2><p>${escapeHtml(alert.ticker)} crossed ${escapeHtml(alert.direction)} your $${escapeHtml(alert.target_price)} target.</p><p>Observed price: $${escapeHtml(price ?? alert.last_price)}</p><p>Observed at ${escapeHtml(alert.triggered_at ?? now.toISOString())}. Quotes can be delayed.</p>`, sub.management_token, `price-alert-${alert.id}`);
          const { error: updateError } = await db.from('price_alerts').update({ delivered_at: now.toISOString() }).eq('id', alert.id);
          if (updateError) throw updateError;
          sent++;
        } catch (e) { failed++; console.error('Price alert delivery failed', e instanceof Error ? e.message : 'unknown'); }
      }
    }
    return json({ sent, failed });
  } catch (e) {
    console.error('Stock email job failed', e instanceof Error ? e.message : 'unknown');
    return json({ error: 'Email processing failed.' }, 500);
  } finally {
    if (claimed) {
      const body = await req.clone().json().catch(() => null);
      if (body?.job) await db.rpc('release_stock_email_job', { job_name: body.job });
    }
  }
});