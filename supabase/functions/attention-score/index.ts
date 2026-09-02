// Attention Score — deterministic, market-data driven ranking of which holdings
// actually need the user's attention today (vs. which are quiet).
import { sanitizeTickers } from '../_shared/validation.ts';
import { writeAppCache } from '../_shared/cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UA = { 'User-Agent': 'Mozilla/5.0' };
const CRYPTO: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };
const ysym = (t: string) => CRYPTO[t] || t;

interface Signal { label: string; weight: number; kind: string }
interface Row {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  score: number;
  bucket: 'attention' | 'watch' | 'quiet';
  headline: string;
  signals: Signal[];
  news?: { title: string; url: string; publisher: string } | null;
}

async function jget(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function stdev(v: number[]): number {
  if (v.length < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

const daysUntil = (sec: number) => Math.round((sec * 1000 - Date.now()) / 86400000);

async function analyze(ticker: string, userTarget?: number): Promise<Row | null> {
  const sym = encodeURIComponent(ysym(ticker));
  const [chart, qs, search] = await Promise.all([
    jget(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=6mo`),
    jget(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=calendarEvents,financialData,price,upgradeDowngradeHistory,defaultKeyStatistics`),
    jget(`https://query1.finance.yahoo.com/v1/finance/search?q=${sym}&newsCount=6&quotesCount=0`),
  ]);

  // deno-lint-ignore no-explicit-any
  const r: any = (chart as any)?.chart?.result?.[0];
  if (!r) return null;
  const closes: number[] = (r.indicators?.quote?.[0]?.close ?? []).filter((c: unknown) => typeof c === 'number' && c > 0);
  const volumes: number[] = (r.indicators?.quote?.[0]?.volume ?? []).filter((v: unknown) => typeof v === 'number');
  if (closes.length < 10) return null;

  const price = r.meta?.regularMarketPrice ?? closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const changePct = prev > 0 ? (price / prev - 1) * 100 : 0;

  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const sigma = stdev(rets.slice(-60)) * 100;
  const z = sigma > 0 ? Math.abs(changePct) / sigma : 0;

  // deno-lint-ignore no-explicit-any
  const s: any = (qs as any)?.quoteSummary?.result?.[0] ?? {};
  const name = s.price?.longName || s.price?.shortName || r.meta?.longName || ticker;

  const signals: Signal[] = [];
  let headline = '';

  // 1. Price movement relative to normal volatility
  if (z >= 2 && Math.abs(changePct) >= 2) {
    signals.push({
      kind: 'move',
      label: `unusual ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% move (${z.toFixed(1)}× normal)`,
      weight: Math.min(45, 18 + z * 7),
    });
    headline ||= `unusual ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% move`;
  } else if (Math.abs(changePct) >= 4) {
    signals.push({ kind: 'move', label: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% today`, weight: 15 });
  }

  // 2. Earnings approaching
  const earnSec: number | undefined = s.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
  if (typeof earnSec === 'number') {
    const d = daysUntil(earnSec);
    if (d >= 0 && d <= 14) {
      signals.push({ kind: 'earnings', label: `earnings in ${d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'}`}`, weight: d <= 3 ? 40 : d <= 7 ? 28 : 18 });
      if (d <= 7) headline ||= `earnings in ${d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'}`}`;
    }
  }

  // 3. Dividend / event dates
  const divSec: number | undefined = s.calendarEvents?.dividendDate?.raw ?? s.calendarEvents?.exDividendDate?.raw;
  if (typeof divSec === 'number') {
    const d = daysUntil(divSec);
    if (d >= 0 && d <= 10) signals.push({ kind: 'dividend', label: `dividend/ex-date in ${d} day${d === 1 ? '' : 's'}`, weight: 10 });
  }

  // 4. Unusual volume
  const recentVol = volumes[volumes.length - 1] ?? 0;
  const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / Math.max(1, volumes.slice(-21, -1).length);
  if (avgVol > 0 && recentVol / avgVol >= 1.8) {
    const x = recentVol / avgVol;
    signals.push({ kind: 'volume', label: `volume ${x.toFixed(1)}× the 20-day average`, weight: Math.min(28, 12 + x * 4) });
    headline ||= `volume ${x.toFixed(1)}× normal`;
  }

  // 5. Breaking technical levels
  const win = closes.slice(-126);
  const hi = Math.max(...win), lo = Math.min(...win);
  if (price >= hi * 0.995) {
    signals.push({ kind: 'technical', label: 'breaking to a new 6-month high', weight: 24 });
    headline ||= 'new 6-month high';
  } else if (price <= lo * 1.005) {
    signals.push({ kind: 'technical', label: 'breaking down to a 6-month low', weight: 26 });
    headline ||= 'new 6-month low';
  } else {
    const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
    const prevAbove = prev > ma50, nowAbove = price > ma50;
    if (prevAbove !== nowAbove) {
      signals.push({ kind: 'technical', label: `crossed ${nowAbove ? 'above' : 'below'} its 50-day average`, weight: 16 });
    }
  }

  // 6. Analyst estimate / rating changes (last 14 days)
  // deno-lint-ignore no-explicit-any
  const grades: any[] = s.upgradeDowngradeHistory?.history ?? [];
  const recentGrade = grades.find((g) => typeof g?.epochGradeDate === 'number' && daysUntil(g.epochGradeDate) >= -14);
  if (recentGrade) {
    const act = String(recentGrade.action || '').toLowerCase();
    const dir = act === 'up' ? 'upgrade' : act === 'down' ? 'downgrade' : 'rating change';
    signals.push({ kind: 'analyst', label: `${dir} — ${recentGrade.firm}: ${recentGrade.toGrade}`, weight: act === 'up' || act === 'down' ? 22 : 10 });
    headline ||= `analyst ${dir}`;
  }

  // 7. Analyst price target vs price (material changes to fundamentals proxy)
  const target: number | undefined = s.financialData?.targetMeanPrice?.raw;
  if (typeof target === 'number' && target > 0 && price > 0) {
    const gap = (target / price - 1) * 100;
    if (gap <= 0) {
      signals.push({ kind: 'target', label: `trading above the analyst target ($${target.toFixed(2)})`, weight: 18 });
      headline ||= 'above analyst target';
    } else if (gap >= 35) {
      signals.push({ kind: 'target', label: `${gap.toFixed(0)}% below the analyst target ($${target.toFixed(2)})`, weight: 12 });
    }
  }

  // 8. User's own price target
  if (typeof userTarget === 'number' && userTarget > 0 && price >= userTarget) {
    signals.push({ kind: 'usertarget', label: `your price target of $${userTarget.toFixed(2)} reached`, weight: 45 });
    headline = 'price target reached';
  }

  // 9. Material fundamentals shift — margins / growth flagged by Yahoo financialData
  const rg: number | undefined = s.financialData?.revenueGrowth?.raw;
  const eg: number | undefined = s.financialData?.earningsGrowth?.raw;
  if (typeof eg === 'number' && eg <= -0.25) {
    signals.push({ kind: 'fundamentals', label: `earnings growth down ${(eg * 100).toFixed(0)}% YoY`, weight: 14 });
  } else if (typeof rg === 'number' && rg <= -0.15) {
    signals.push({ kind: 'fundamentals', label: `revenue shrinking ${(rg * 100).toFixed(0)}% YoY`, weight: 12 });
  }

  // 10. Major news in the last 48h
  // deno-lint-ignore no-explicit-any
  const news: any[] = (search as any)?.news ?? [];
  const fresh = news.find((n) => typeof n?.providerPublishTime === 'number' && Date.now() - n.providerPublishTime * 1000 < 48 * 3600 * 1000);
  let topNews: Row['news'] = null;
  if (fresh) {
    topNews = { title: String(fresh.title || ''), url: String(fresh.link || ''), publisher: String(fresh.publisher || '') };
    signals.push({ kind: 'news', label: `news: ${topNews.title}`.slice(0, 160), weight: 16 });
    headline ||= 'fresh news coverage';
  }

  const score = Math.min(100, Math.round(signals.reduce((a, b) => a + b.weight, 0)));
  const bucket: Row['bucket'] = score >= 45 ? 'attention' : score >= 18 ? 'watch' : 'quiet';

  return {
    ticker,
    name,
    price: Number(price.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    score,
    bucket,
    headline: headline || 'no material change',
    signals: signals.sort((a, b) => b.weight - a.weight),
    news: topNews,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tickers = sanitizeTickers(body?.tickers);
    const rawTargets = body?.targets && typeof body.targets === 'object' ? body.targets as Record<string, unknown> : {};
    const targets: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawTargets)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) targets[k.toUpperCase()] = n;
    }

    if (tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'valid tickers array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows: Row[] = [];
    // Batch to stay friendly with Yahoo.
    for (let i = 0; i < tickers.length; i += 6) {
      const chunk = tickers.slice(i, i + 6);
      const res = await Promise.all(chunk.map((t) => analyze(t, targets[t]).catch(() => null)));
      for (const r of res) if (r) rows.push(r);
    }

    rows.sort((a, b) => b.score - a.score);
    const payload = {
      generatedAt: new Date().toISOString(),
      attention: rows.filter((r) => r.bucket === 'attention'),
      watch: rows.filter((r) => r.bucket === 'watch'),
      quiet: rows.filter((r) => r.bucket === 'quiet'),
      skipped: tickers.filter((t) => !rows.some((r) => r.ticker === t)),
    };

    await writeAppCache(`attention-score:${[...tickers].sort().join(',')}`, payload, 60 * 60 * 1000);

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('attention-score error:', (e as Error).message);
    return new Response(JSON.stringify({ error: 'Could not build the attention score.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
