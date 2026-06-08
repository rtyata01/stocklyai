// Cycle / wave detection from Yahoo Finance daily history.
// Deterministic algorithm (no AI): identifies repeating high/low swings
// in 3M and 6M windows, and flags current price position in the cycle.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;
const SYMBOL_MAP: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };

interface Point { date: string; close: number }
interface Pivot { date: string; close: number; type: 'high' | 'low' }

interface WindowStats {
  high: number;
  low: number;
  mid: number;
  highCount: number;
  lowCount: number;
  isCyclic: boolean;
  pivots: Pivot[];
}

interface CycleResult {
  ticker: string;
  currentPrice: number;
  position: 'bottom' | 'middle' | 'top' | 'unknown';
  positionPct: number; // 0=low, 100=high within 6M range
  window3m: WindowStats;
  window6m: WindowStats;
  summary: string;
  history: Point[]; // 6mo daily
}

async function fetchDaily(ticker: string): Promise<Point[]> {
  try {
    const symbol = SYMBOL_MAP[ticker] || ticker;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    const ts: number[] = r?.timestamp || [];
    const closes: number[] = r?.indicators?.quote?.[0]?.close || [];
    const out: Point[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c === 'number' && c > 0) {
        out.push({ date: new Date(ts[i] * 1000).toISOString().split('T')[0], close: +c.toFixed(2) });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// Local extrema with adaptive window. minProm = min % move vs surrounding range
function findPivots(points: Point[], window = 5, minPromPct = 0.04): Pivot[] {
  const piv: Pivot[] = [];
  if (points.length < window * 2 + 1) return piv;
  const overallHigh = Math.max(...points.map(p => p.close));
  const overallLow = Math.min(...points.map(p => p.close));
  const range = Math.max(overallHigh - overallLow, 1e-6);
  for (let i = window; i < points.length - window; i++) {
    const c = points[i].close;
    let isHigh = true, isLow = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j === i) continue;
      if (points[j].close > c) isHigh = false;
      if (points[j].close < c) isLow = false;
    }
    if (isHigh) {
      // prominence: how much above nearby min
      const segMin = Math.min(...points.slice(Math.max(0, i - window * 3), Math.min(points.length, i + window * 3 + 1)).map(p => p.close));
      if ((c - segMin) / range >= minPromPct) piv.push({ date: points[i].date, close: c, type: 'high' });
    } else if (isLow) {
      const segMax = Math.max(...points.slice(Math.max(0, i - window * 3), Math.min(points.length, i + window * 3 + 1)).map(p => p.close));
      if ((segMax - c) / range >= minPromPct) piv.push({ date: points[i].date, close: c, type: 'low' });
    }
  }
  // alternate consecutive same-type pivots: keep the more extreme
  const merged: Pivot[] = [];
  for (const p of piv) {
    const last = merged[merged.length - 1];
    if (!last || last.type !== p.type) merged.push(p);
    else if (p.type === 'high' && p.close > last.close) merged[merged.length - 1] = p;
    else if (p.type === 'low' && p.close < last.close) merged[merged.length - 1] = p;
  }
  return merged;
}

function analyzeWindow(all: Point[], days: number): WindowStats {
  const cutoff = Date.now() - days * 86_400_000;
  const slice = all.filter(p => Date.parse(p.date) >= cutoff);
  if (slice.length === 0) {
    return { high: 0, low: 0, mid: 0, highCount: 0, lowCount: 0, isCyclic: false, pivots: [] };
  }
  const high = Math.max(...slice.map(p => p.close));
  const low = Math.min(...slice.map(p => p.close));
  const mid = +((high + low) / 2).toFixed(2);
  const win = days <= 90 ? 4 : 5;
  const pivots = findPivots(slice, win, 0.04);
  const highCount = pivots.filter(p => p.type === 'high').length;
  const lowCount = pivots.filter(p => p.type === 'low').length;
  const isCyclic = highCount >= 2 && lowCount >= 2;
  return { high: +high.toFixed(2), low: +low.toFixed(2), mid, highCount, lowCount, isCyclic, pivots };
}

function evaluateTicker(ticker: string, history: Point[]): CycleResult {
  const w3 = analyzeWindow(history, 90);
  const w6 = analyzeWindow(history, 180);
  const currentPrice = history.length ? history[history.length - 1].close : 0;
  // position within 6M range
  const range6 = Math.max(w6.high - w6.low, 1e-6);
  const positionPct = currentPrice > 0 && w6.high > 0
    ? Math.max(0, Math.min(100, +(((currentPrice - w6.low) / range6) * 100).toFixed(1)))
    : 0;
  let position: CycleResult['position'] = 'unknown';
  if (currentPrice > 0 && w6.high > 0) {
    if (positionPct <= 25) position = 'bottom';
    else if (positionPct >= 75) position = 'top';
    else position = 'middle';
  }
  const cyclic = w3.isCyclic || w6.isCyclic;
  const summary = cyclic
    ? `Cyclic pattern detected — ${w6.highCount} highs / ${w6.lowCount} lows in 6M, ${w3.highCount}/${w3.lowCount} in 3M. Current price is ${positionPct.toFixed(0)}% within 6M range (${position}).`
    : `No clear repeating cycle in 6M window — price is ${positionPct.toFixed(0)}% within range (${position}). Showing high/mid/low for reference.`;
  return { ticker, currentPrice, position, positionPct, window3m: w3, window6m: w6, summary, history };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const mode: 'evaluate' | 'best' = body.mode === 'best' ? 'best' : 'evaluate';
    const rawTickers: string[] = Array.isArray(body.tickers) ? body.tickers : [];
    const tickers = Array.from(new Set(
      rawTickers.map(t => String(t || '').trim().toUpperCase()).filter(t => TICKER_RE.test(t))
    )).slice(0, 12);

    if (tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'no valid tickers' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const histories = await Promise.all(tickers.map(t => fetchDaily(t)));
    const results: CycleResult[] = tickers.map((t, i) => evaluateTicker(t, histories[i]))
      .filter(r => r.history.length > 0);

    if (mode === 'best') {
      // Rank: cyclic + near bottom + many lows
      const ranked = results
        .map(r => {
          const cyclicScore = (r.window3m.isCyclic ? 2 : 0) + (r.window6m.isCyclic ? 2 : 0);
          const bottomScore = Math.max(0, 100 - r.positionPct) / 25; // 0..4
          const pivotScore = Math.min(4, r.window6m.lowCount);
          return { r, score: cyclicScore + bottomScore + pivotScore };
        })
        .filter(x => x.r.window3m.isCyclic || x.r.window6m.isCyclic) // must be cyclic
        .filter(x => x.r.positionPct <= 40) // near bottom
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(x => x.r);
      return new Response(JSON.stringify({ mode, results: ranked, evaluated: results.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ mode, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('detect-cycles error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
