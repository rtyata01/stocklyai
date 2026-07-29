import { sanitizeTickers } from '../_shared/validation.ts';
import { writeAppCache } from '../_shared/cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BENCHMARKS = ['SPY', 'VOO'];
const CRYPTO: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };

interface Point { date: string; close: number }

async function fetchHistory(ticker: string, range: string): Promise<Point[]> {
  try {
    const symbol = CRYPTO[ticker] || ticker;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    if (!r) return [];
    const stamps: number[] = r.timestamp ?? [];
    const closes: (number | null)[] = r.indicators?.quote?.[0]?.close ?? [];
    const out: Point[] = [];
    for (let i = 0; i < stamps.length; i++) {
      const c = closes[i];
      if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
        out.push({ date: new Date(stamps[i] * 1000).toISOString().slice(0, 10), close: c });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

function dailyReturns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1] > 0) out.push(series[i] / series[i - 1] - 1);
  }
  return out;
}

function maxDrawdown(series: number[]): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    if (peak > 0) mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd * 100;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tickers = sanitizeTickers(body?.tickers);
    const horizon = body?.horizon === '12m' ? '12m' : '6m';
    const range = horizon === '12m' ? '1y' : '6mo';
    const sectorMap: Record<string, string> =
      body?.sectorMap && typeof body.sectorMap === 'object' ? body.sectorMap : {};

    if (tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'valid tickers array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const all = [...tickers, ...BENCHMARKS.filter((b) => !tickers.includes(b))];
    const histories = await Promise.all(all.map((t) => fetchHistory(t, range)));
    const map = new Map<string, Point[]>();
    all.forEach((t, i) => map.set(t, histories[i]));

    // Common trading-day axis from SPY (fallback: longest series)
    let axis = map.get('SPY') ?? [];
    if (axis.length < 5) {
      axis = histories.reduce((best, h) => (h.length > best.length ? h : best), [] as Point[]);
    }
    const dates = axis.map((p) => p.date);

    // Forward-fill each ticker onto the axis
    const aligned = new Map<string, number[]>();
    for (const t of all) {
      const pts = map.get(t) ?? [];
      if (pts.length < 2) continue;
      const byDate = new Map(pts.map((p) => [p.date, p.close]));
      const vals: number[] = [];
      let last = pts[0].close;
      for (const d of dates) {
        const v = byDate.get(d);
        if (typeof v === 'number') last = v;
        vals.push(last);
      }
      aligned.set(t, vals);
    }

    const held = tickers.filter((t) => aligned.has(t));
    if (held.length === 0 || dates.length < 5) {
      return new Response(JSON.stringify({ error: 'not enough market history' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const INVEST = 1000;
    // $1000 per stock invested at the start of the window
    const portfolioSeries = dates.map((_, i) =>
      held.reduce((sum, t) => {
        const v = aligned.get(t)!;
        return sum + INVEST * (v[i] / v[0]);
      }, 0),
    );
    const invested = INVEST * held.length;

    const benchSeries: Record<string, number[]> = {};
    for (const b of BENCHMARKS) {
      const v = aligned.get(b);
      if (v) benchSeries[b] = dates.map((_, i) => invested * (v[i] / v[0]));
    }

    // Downsample chart to ~60 points
    const step = Math.max(1, Math.ceil(dates.length / 60));
    const chart = dates
      .map((d, i) => ({
        date: d,
        portfolio: Math.round(portfolioSeries[i]),
        SPY: benchSeries.SPY ? Math.round(benchSeries.SPY[i]) : null,
        VOO: benchSeries.VOO ? Math.round(benchSeries.VOO[i]) : null,
      }))
      .filter((_, i) => i % step === 0 || i === dates.length - 1);

    const holdings = held
      .map((t) => {
        const v = aligned.get(t)!;
        const value = INVEST * (v[v.length - 1] / v[0]);
        const ret = (value / INVEST - 1) * 100;
        const vol = stdev(dailyReturns(v)) * Math.sqrt(252) * 100;
        return {
          ticker: t,
          sector: sectorMap[t] ?? 'Other',
          value: Number(value.toFixed(2)),
          gain: Number((value - INVEST).toFixed(2)),
          returnPct: Number(ret.toFixed(2)),
          volatility: Number(vol.toFixed(1)),
          maxDrawdown: Number(maxDrawdown(v).toFixed(1)),
          weight: 0,
        };
      })
      .sort((a, b) => b.returnPct - a.returnPct);

    const totalValue = holdings.reduce((s, h) => s + h.value, 0);
    holdings.forEach((h) => { h.weight = Number(((h.value / totalValue) * 100).toFixed(2)); });

    const portfolioReturn = (totalValue / invested - 1) * 100;
    const benchReturns: Record<string, number> = {};
    for (const b of Object.keys(benchSeries)) {
      const s = benchSeries[b];
      benchReturns[b] = Number((((s[s.length - 1]) / invested - 1) * 100).toFixed(2));
    }

    const pRets = dailyReturns(portfolioSeries);
    const volatility = stdev(pRets) * Math.sqrt(252) * 100;
    const mdd = maxDrawdown(portfolioSeries);

    // Beta vs SPY
    let beta = 1;
    if (benchSeries.SPY) {
      const bRets = dailyReturns(benchSeries.SPY);
      const n = Math.min(pRets.length, bRets.length);
      const pm = pRets.slice(0, n).reduce((a, b) => a + b, 0) / n;
      const bm = bRets.slice(0, n).reduce((a, b) => a + b, 0) / n;
      let cov = 0, varb = 0;
      for (let i = 0; i < n; i++) {
        cov += (pRets[i] - pm) * (bRets[i] - bm);
        varb += (bRets[i] - bm) ** 2;
      }
      if (varb > 0) beta = cov / varb;
    }

    const sharpe = stdev(pRets) > 0
      ? ((pRets.reduce((a, b) => a + b, 0) / pRets.length) * 252) / (stdev(pRets) * Math.sqrt(252))
      : 0;

    // Allocation by sector
    const allocMap = new Map<string, number>();
    for (const h of holdings) allocMap.set(h.sector, (allocMap.get(h.sector) ?? 0) + h.value);
    const allocation = Array.from(allocMap.entries())
      .map(([sector, value]) => ({
        sector,
        value: Number(value.toFixed(2)),
        weight: Number(((value / totalValue) * 100).toFixed(2)),
      }))
      .sort((a, b) => b.weight - a.weight);

    // Health score (0-100)
    const alpha = portfolioReturn - (benchReturns.SPY ?? 0);
    const diversification = Math.min(100, (held.length / 15) * 60 + Math.max(0, 40 - (allocation[0]?.weight ?? 0)));
    const perfScore = Math.max(0, Math.min(100, 50 + alpha * 2.5));
    const riskScore = Math.max(0, Math.min(100, 100 - Math.max(0, volatility - 18) * 2 - Math.max(0, Math.abs(mdd) - 15) * 1.5));
    const consistency = Math.max(0, Math.min(100, 50 + sharpe * 25));
    const healthScore = Math.round(perfScore * 0.35 + riskScore * 0.3 + diversification * 0.2 + consistency * 0.15);

    const result = {
      horizon,
      generatedAt: new Date().toISOString(),
      invested: Number(invested.toFixed(2)),
      currentValue: Number(totalValue.toFixed(2)),
      gain: Number((totalValue - invested).toFixed(2)),
      returnPct: Number(portfolioReturn.toFixed(2)),
      benchmarks: benchReturns,
      alphaVsSpy: Number(alpha.toFixed(2)),
      risk: {
        volatility: Number(volatility.toFixed(1)),
        maxDrawdown: Number(mdd.toFixed(1)),
        beta: Number(beta.toFixed(2)),
        sharpe: Number(sharpe.toFixed(2)),
      },
      scores: {
        health: healthScore,
        performance: Math.round(perfScore),
        risk: Math.round(riskScore),
        diversification: Math.round(diversification),
        consistency: Math.round(consistency),
      },
      allocation,
      holdings,
      chart,
      skipped: tickers.filter((t) => !aligned.has(t)),
    };

    const cacheKey = `portfolio-analytics:${horizon}:${[...tickers].sort().join(',')}`;
    await writeAppCache(cacheKey, result, 6 * 60 * 60 * 1000);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('portfolio-analytics error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
