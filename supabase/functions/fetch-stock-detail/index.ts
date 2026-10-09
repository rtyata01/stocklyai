import { writeAppCache } from '../_shared/cache.ts';
import { isValidTicker } from '../_shared/validation.ts';
import { secFundamentals } from '../_shared/secFundamentals.ts';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';


const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };

const cryptoMap: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };

interface PeriodReturn {
  period: '1W' | '1M' | '3M' | '6M' | '1Y' | '4Y';
  label: string;
  startPrice: number;
  endValue: number;
  returnPct: number;
}

// ---------- Yahoo Finance data fetchers ----------

async function yahooChart(symbol: string, range: string, interval: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}`);
  return await res.json();
}

async function yahooCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    const r1 = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' });
    const setCookie = r1.headers.get('set-cookie') ?? '';
    const cookie = setCookie.split(',').map((c) => c.split(';')[0].trim()).filter((c) => c.includes('=')).join('; ');
    if (!cookie) return null;
    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, Cookie: cookie } });
    const crumb = (await r2.text()).trim();
    if (!r2.ok || !crumb || crumb.includes(' ') || crumb.length > 40) return null;
    return { cookie, crumb };
  } catch { return null; }
}

async function alphaOverview(symbol: string): Promise<any | null> {
  const key = Deno.env.get('ALPHA_VANTAGE_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${key}`);
    if (!res.ok) return null;
    const j = await res.json();
    return j?.Symbol ? j : null;
  } catch { return null; }
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

async function yahooQuoteSummary(symbol: string): Promise<any | null> {
  // Try the v10 quoteSummary (needs cookie+crumb) then fall back to v7 quote.
  const modules = 'summaryDetail,defaultKeyStatistics,financialData,price,calendarEvents,earnings';
  const auth = await yahooCrumb();
  for (const a of [auth, null]) {
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}${a ? `&crumb=${encodeURIComponent(a.crumb)}` : ''}`;
      const res = await fetch(url, { headers: a ? { ...UA, Cookie: a.cookie } : UA });
      if (res.ok) {
        const j = await res.json();
        const result = j?.quoteSummary?.result?.[0];
        if (result) return { source: 'v10', data: result };
      }
    } catch { /* ignore */ }
  }

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}${auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : ''}`;
    const res = await fetch(url, { headers: auth ? { ...UA, Cookie: auth.cookie } : UA });
    if (res.ok) {
      const j = await res.json();
      const q = j?.quoteResponse?.result?.[0];
      if (q) return { source: 'v7', data: q };
    }
  } catch { /* ignore */ }

  return null;
}

function buildPeriodReturns(timestamps: number[], closes: (number | null)[], currentPrice: number): PeriodReturn[] {
  const now = Math.floor(Date.now() / 1000);
  const periods: { period: PeriodReturn['period']; label: string; secondsAgo: number }[] = [
    { period: '1W', label: '1 Week', secondsAgo: 7 * 86400 },
    { period: '1M', label: '1 Month', secondsAgo: 30 * 86400 },
    { period: '3M', label: '3 Months', secondsAgo: 91 * 86400 },
    { period: '6M', label: '6 Months', secondsAgo: 182 * 86400 },
    { period: '1Y', label: '1 Year', secondsAgo: 365 * 86400 },
    { period: '4Y', label: '4 Years', secondsAgo: 4 * 365 * 86400 },
  ];

  const out: PeriodReturn[] = [];
  for (const p of periods) {
    const target = now - p.secondsAgo;
    // Find the closest timestamp >= target with a non-null close
    let idx = -1;
    for (let i = 0; i < timestamps.length; i++) {
      if (timestamps[i] >= target && closes[i] != null) { idx = i; break; }
    }
    if (idx === -1) continue;
    const startPrice = closes[idx] as number;
    if (!startPrice || startPrice <= 0) continue;
    const returnPct = ((currentPrice - startPrice) / startPrice) * 100;
    const endValue = 1000 * (currentPrice / startPrice);
    out.push({ period: p.period, label: p.label, startPrice, endValue, returnPct });
  }
  return out;
}

function buildQuarterlyPriceHistory(timestamps: number[], closes: (number | null)[]): { period: string; price: number }[] {
  // Take last 8 quarter-end-ish samples (every ~63 trading days back from end)
  const out: { period: string; price: number }[] = [];
  if (!timestamps.length) return out;
  const lastIdx = timestamps.length - 1;
  for (let q = 7; q >= 0; q--) {
    const idx = Math.max(0, lastIdx - q * 63);
    if (closes[idx] == null) continue;
    const d = new Date(timestamps[idx] * 1000);
    const quarter = `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
    out.push({ period: quarter, price: closes[idx] as number });
  }
  return out;
}

// ---------- Earnings (historical actuals) from Yahoo ----------

function extractHistoricalEarnings(qs: any): {
  quarterly: { quarter: string; eps: number; revenue: number }[];
  yearly: { year: string; eps: number; revenue: number }[];
} {
  const earnings = qs?.data?.earnings;
  const quarterlyHistory = earnings?.earningsChart?.quarterly ?? [];
  const yearlyHistory = earnings?.financialsChart?.yearly ?? [];
  const quarterlyFin = earnings?.financialsChart?.quarterly ?? [];

  const quarterly = quarterlyHistory.map((q: any, i: number) => ({
    quarter: q.date ?? `Q${i + 1}`,
    eps: q.actual?.raw ?? 0,
    revenue: (quarterlyFin[i]?.revenue?.raw ?? 0) / 1_000_000,
  }));

  const yearly = yearlyHistory.map((y: any) => ({
    year: String(y.date ?? ''),
    eps: y.earnings?.raw ?? 0,
    revenue: (y.revenue?.raw ?? 0) / 1_000_000,
  }));

  return { quarterly, yearly };
}

// ---------- AI for forward estimates + catalysts only ----------

async function fetchAiSupplements(ticker: string, currentPrice: number, historicalQuarters: any[], historicalYears: any[]) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  const today = new Date().toISOString().split('T')[0];
  const needPastQuarters = Math.max(0, 3 - historicalQuarters.length);
  const needPastYears = Math.max(0, 3 - historicalYears.length);
  const histCtx = `Recent actual quarterly earnings (already known, do NOT repeat): ${JSON.stringify(historicalQuarters)}\nRecent actual yearly earnings (already known, do NOT repeat): ${JSON.stringify(historicalYears)}\nCurrent price: $${currentPrice}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You provide forward-looking analyst consensus estimates and upcoming catalysts. You may also provide REPORTED past actuals when explicitly asked to fill gaps. Use Wall Street consensus where available. All revenue in millions USD.` },
          { role: 'user', content: `Ticker: ${ticker}. Today: ${today}.\n${histCtx}\n\nProvide:\n1. ${needPastQuarters > 0 ? `${needPastQuarters} most-recent REPORTED past quarters (actuals) NOT already in the known list — put these in pastQuarters.` : 'No past quarters needed.'}\n2. Next 4 quarters EPS and revenue ESTIMATES (current quarter + 3 future) — put in forwardQuarters.\n3. ${needPastYears > 0 ? `${needPastYears} most-recent REPORTED past years (actuals) NOT in known list — put in pastYears.` : 'No past years needed.'}\n4. Next 4 years EPS and revenue ESTIMATES (current year + 3 future) — put in forwardYears.\n5. 3-8 upcoming major catalysts with dates if known.\n6. focusAreas: 3-5 core business areas this company focuses on and prioritises (e.g. product lines, segments, strategic bets). For each: a short area name (1-4 words), one concise sentence describing it, and revenueShare as an approximate percentage of revenue (0 if unknown).` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_supplements',
            parameters: {
              type: 'object',
              properties: {
                pastQuarters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { quarter: { type: 'string' }, eps: { type: 'number' }, revenue: { type: 'number' } },
                    required: ['quarter', 'eps', 'revenue'],
                  },
                },
                forwardQuarters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { quarter: { type: 'string' }, eps: { type: 'number' }, revenue: { type: 'number' } },
                    required: ['quarter', 'eps', 'revenue'],
                  },
                },
                pastYears: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { year: { type: 'string' }, eps: { type: 'number' }, revenue: { type: 'number' } },
                    required: ['year', 'eps', 'revenue'],
                  },
                },
                forwardYears: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { year: { type: 'string' }, eps: { type: 'number' }, revenue: { type: 'number' } },
                    required: ['year', 'eps', 'revenue'],
                  },
                },
                catalysts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      event: { type: 'string' },
                      date: { type: 'string' },
                      impact: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
                      details: { type: 'string' },
                    },
                    required: ['event', 'impact', 'details'],
                  },
                },
                focusAreas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      area: { type: 'string' },
                      description: { type: 'string' },
                      revenueShare: { type: 'number' },
                    },
                    required: ['area', 'description'],
                  },
                },
              },
              required: ['forwardQuarters', 'forwardYears', 'catalysts', 'focusAreas'],

            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_supplements' } },
      }),
    });
    if (!response.ok) return null;
    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;
    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error('AI supplement error:', e);
    return null;
  }
}

// ---------- Main ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const ticker = typeof body?.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    if (!isValidTicker(ticker)) {
      return new Response(JSON.stringify({ error: 'valid ticker required (A-Z 0-9 . - up to 10 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const symbol = cryptoMap[ticker] ?? ticker;
    const isCrypto = !!cryptoMap[ticker];

    // 1. Long history for 4Y returns + 52w + simulation
    const chart4y = await yahooChart(symbol, '5y', '1d');
    const result = chart4y?.chart?.result?.[0];
    if (!result) throw new Error('No price history available');

    const meta = result.meta ?? {};
    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const currentPrice = meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0;

    // 52-week high/low from actual last 252 trading days (or whatever range Yahoo provides as range='1y')
    let week52High = meta.fiftyTwoWeekHigh ?? 0;
    let week52Low = meta.fiftyTwoWeekLow ?? 0;
    if (!week52High || !week52Low) {
      // Compute from last ~252 closes
      const start = Math.max(0, closes.length - 252);
      const window = closes.slice(start).filter((c): c is number => c != null);
      if (window.length) {
        week52High = Math.max(...window);
        week52Low = Math.min(...window);
      }
    }

    // 2. Fundamentals from quoteSummary / v7 quote
    const qs = await yahooQuoteSummary(symbol);
    let peRatio: number | null = null;
    let eps: number | null = null;
    let freeCashFlow: number | null = null;
    let totalRevenue: number | null = null;
    let marketCap: number | null = num(meta.marketCap) != null ? Number(meta.marketCap) / 1e9 : null;
    const fundamentalSources = ['Yahoo Finance'];
    let reportingDate: string | null = null;

    if (qs?.source === 'v10') {
      const sd = qs.data.summaryDetail ?? {};
      const ks = qs.data.defaultKeyStatistics ?? {};
      const fd = qs.data.financialData ?? {};
      const pr = qs.data.price ?? {};
      peRatio = sd.trailingPE?.raw ?? null;
      eps = ks.trailingEps?.raw ?? null;
      freeCashFlow = num(fd.freeCashflow?.raw) != null ? fd.freeCashflow.raw / 1_000_000 : null;
      totalRevenue = num(fd.totalRevenue?.raw) != null ? fd.totalRevenue.raw / 1_000_000 : null;
      marketCap = num(pr.marketCap?.raw) != null ? pr.marketCap.raw / 1_000_000_000 : (num(sd.marketCap?.raw) != null ? sd.marketCap.raw / 1_000_000_000 : marketCap);
    } else if (qs?.source === 'v7') {
      const q = qs.data;
      peRatio = q.trailingPE ?? null;
      eps = q.epsTrailingTwelveMonths ?? null;
      marketCap = num(q.marketCap) != null ? q.marketCap / 1_000_000_000 : marketCap;
    }

    if (isCrypto) { peRatio = null; eps = null; }
    // Reported SEC filings are a grounded fallback, never AI-invented financial values.
    if (!isCrypto && [peRatio, eps, freeCashFlow, totalRevenue, marketCap].some(v => v == null)) {
      const sec = await secFundamentals(ticker, currentPrice);
      if (sec) {
        peRatio ??= sec.peRatio;
        eps ??= sec.eps;
        freeCashFlow ??= sec.freeCashFlow;
        totalRevenue ??= sec.totalRevenue;
        marketCap ??= sec.marketCap;
        reportingDate = sec.reportingDate;
        fundamentalSources.push('SEC company filings (TTM; market cap estimated from reported shares when needed)');
      }
    }

    // 3. Historical earnings (actuals only)
    const historical = qs?.source === 'v10' ? extractHistoricalEarnings(qs) : { quarterly: [], yearly: [] };

    // 4. Period returns + price history
    const periodReturns = buildPeriodReturns(timestamps, closes, currentPrice);
    const priceHistory = buildQuarterlyPriceHistory(timestamps, closes);

    // 5. AI supplements (forward estimates + catalysts only — never historical)
    const supplements = await fetchAiSupplements(ticker, currentPrice, historical.quarterly, historical.yearly);

    const quarterlyEarnings = [
      ...((supplements?.pastQuarters ?? []).map((q: any) => ({ ...q, isEstimate: false }))),
      ...historical.quarterly.map(q => ({ ...q, isEstimate: false })),
      ...((supplements?.forwardQuarters ?? []).map((q: any) => ({ ...q, isEstimate: true }))),
    ];

    const yearlyEarnings = [
      ...((supplements?.pastYears ?? []).map((y: any) => ({ ...y, isEstimate: false }))),
      ...historical.yearly.map(y => ({ ...y, isEstimate: false })),
      ...((supplements?.forwardYears ?? []).map((y: any) => ({ ...y, isEstimate: true }))),
    ];

    // AI catalysts are always unverified; drop undated or out-of-window (>12 months) events.
    const nowMs = Date.now();
    const inWindow = (d: unknown) => {
      if (typeof d !== 'string' || !/^\d{4}-\d{2}(-\d{2})?$/.test(d)) return false;
      const t = new Date(d.length === 7 ? `${d}-01` : d).getTime();
      return Number.isFinite(t) && t >= nowMs - 31 * 86400000 && t <= nowMs + 365 * 86400000;
    };
    const catalysts: any[] = (supplements?.catalysts ?? [])
      .filter((c: any) => inWindow(c?.date))
      .map((c: any) => ({ event: c.event, date: c.date, impact: c.impact, details: c.details, verified: false }));

    // Confirmed: next earnings date from Yahoo's calendar
    const earnDate = qs?.source === 'v10' ? qs.data.calendarEvents?.earnings?.earningsDate?.[0]?.raw : (qs?.data?.earningsTimestamp ?? null);
    if (typeof earnDate === 'number') {
      const iso = new Date(earnDate * 1000).toISOString().slice(0, 10);
      if (inWindow(iso)) {
        catalysts.unshift({ event: 'Quarterly earnings report', date: iso, impact: 'neutral', details: 'Scheduled earnings release (from Yahoo Finance calendar).', verified: true });
      }
    }

    const focusAreas = (supplements?.focusAreas ?? [])
      .filter((f: any) => f?.area && f?.description)
      .slice(0, 5)
      .map((f: any) => ({
        area: String(f.area),
        description: String(f.description),
        revenueShare: typeof f.revenueShare === 'number' && f.revenueShare > 0 ? f.revenueShare : null,
      }));

    let dividendYield: number | null = null;
    if (qs?.source === 'v10') {
      const sd = qs.data.summaryDetail ?? {};
      const raw = sd.dividendYield?.raw ?? sd.trailingAnnualDividendYield?.raw ?? null;
      dividendYield = typeof raw === 'number' ? raw * 100 : null;
    } else if (qs?.source === 'v7') {
      const q = qs.data;
      const raw = q.dividendYield ?? (q.trailingAnnualDividendYield != null ? q.trailingAnnualDividendYield * 100 : null);
      dividendYield = typeof raw === 'number' ? raw : null;
    }
    // Fill any missing fundamentals from Alpha Vantage
    if (!isCrypto && (peRatio == null || eps == null || marketCap == null || dividendYield == null || totalRevenue == null)) {
      const av = await alphaOverview(symbol);
      if (av) {
        fundamentalSources.push('Alpha Vantage');
        peRatio ??= num(av.PERatio);
        eps ??= num(av.EPS);
        const mc = num(av.MarketCapitalization); if (marketCap == null && mc) marketCap = mc / 1e9;
        const rv = num(av.RevenueTTM); if (totalRevenue == null && rv) totalRevenue = rv / 1e6;
        const dy = num(av.DividendYield); if (dividendYield == null && dy != null) dividendYield = dy * 100;
      }
    }
    if (isCrypto) dividendYield = null;

    const detail = {
      currentPrice,
      week52High,
      week52Low,
      dividendYield,
      peRatio,
      eps,
      freeCashFlow,
      totalRevenue,
      marketCap,
      fundamentalsVersion: 2,
      fundamentalSources,
      reportingDate,
      quarterlyEarnings,
      yearlyEarnings,
      priceHistory,
      investmentSimulation: { initialInvestment: 1000, periodReturns },
      focusAreas,
      catalysts,
    };


    const ttl = [eps, freeCashFlow, totalRevenue, marketCap].filter(v => v == null).length > 2 ? 5 * 60 * 1000 : 4 * 60 * 60 * 1000;
    await writeAppCache(`stock-detail:v2:${ticker}`, { detail }, ttl);

    return new Response(JSON.stringify({ detail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('fetch-stock-detail error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
