import { writeAppCache } from '../_shared/cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}`);
  return await res.json();
}

async function yahooQuoteSummary(symbol: string): Promise<any | null> {
  // Try the v10 quoteSummary (often blocked) then fall back to v7 quote.
  const modules = 'summaryDetail,defaultKeyStatistics,financialData,price,calendarEvents,earnings';
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
    const res = await fetch(url, { headers: UA });
    if (res.ok) {
      const j = await res.json();
      const result = j?.quoteSummary?.result?.[0];
      if (result) return { source: 'v10', data: result };
    }
  } catch { /* ignore */ }

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const res = await fetch(url, { headers: UA });
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
  const histCtx = `Recent actual quarterly earnings: ${JSON.stringify(historicalQuarters)}\nRecent actual yearly earnings: ${JSON.stringify(historicalYears)}\nCurrent price: $${currentPrice}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You provide ONLY forward-looking analyst consensus estimates and upcoming catalysts. Never fabricate historical actuals — those are provided. Use Wall Street consensus where available; if uncertain, give a conservative estimate. All revenue in millions USD.` },
          { role: 'user', content: `Ticker: ${ticker}. Today: ${today}.\n${histCtx}\n\nProvide:\n1. Next 4 quarters EPS and revenue ESTIMATES (consensus).\n2. Next 4 years EPS and revenue ESTIMATES (consensus).\n3. 3-8 upcoming major catalysts with dates if known.` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_supplements',
            parameters: {
              type: 'object',
              properties: {
                forwardQuarters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { quarter: { type: 'string' }, eps: { type: 'number' }, revenue: { type: 'number' } },
                    required: ['quarter', 'eps', 'revenue'],
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
              },
              required: ['forwardQuarters', 'forwardYears', 'catalysts'],
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
    const { ticker } = await req.json();
    if (!ticker) {
      return new Response(JSON.stringify({ error: 'ticker required' }), {
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
    let marketCap: number | null = null;

    if (qs?.source === 'v10') {
      const sd = qs.data.summaryDetail ?? {};
      const ks = qs.data.defaultKeyStatistics ?? {};
      const fd = qs.data.financialData ?? {};
      const pr = qs.data.price ?? {};
      peRatio = sd.trailingPE?.raw ?? null;
      eps = ks.trailingEps?.raw ?? null;
      freeCashFlow = fd.freeCashflow?.raw ? fd.freeCashflow.raw / 1_000_000 : null;
      totalRevenue = fd.totalRevenue?.raw ? fd.totalRevenue.raw / 1_000_000 : null;
      marketCap = pr.marketCap?.raw ? pr.marketCap.raw / 1_000_000_000 : (sd.marketCap?.raw ? sd.marketCap.raw / 1_000_000_000 : null);
    } else if (qs?.source === 'v7') {
      const q = qs.data;
      peRatio = q.trailingPE ?? null;
      eps = q.epsTrailingTwelveMonths ?? null;
      marketCap = q.marketCap ? q.marketCap / 1_000_000_000 : null;
    }

    if (isCrypto) { peRatio = null; eps = null; }

    // 3. Historical earnings (actuals only)
    const historical = qs?.source === 'v10' ? extractHistoricalEarnings(qs) : { quarterly: [], yearly: [] };

    // 4. Period returns + price history
    const periodReturns = buildPeriodReturns(timestamps, closes, currentPrice);
    const priceHistory = buildQuarterlyPriceHistory(timestamps, closes);

    // 5. AI supplements (forward estimates + catalysts only — never historical)
    const supplements = await fetchAiSupplements(ticker, currentPrice, historical.quarterly, historical.yearly);

    const quarterlyEarnings = [
      ...historical.quarterly.map(q => ({ ...q, isEstimate: false })),
      ...((supplements?.forwardQuarters ?? []).map((q: any) => ({ ...q, isEstimate: true }))),
    ];

    const yearlyEarnings = [
      ...historical.yearly.map(y => ({ ...y, isEstimate: false })),
      ...((supplements?.forwardYears ?? []).map((y: any) => ({ ...y, isEstimate: true }))),
    ];

    const catalysts = (supplements?.catalysts ?? []).map((c: any) => ({
      event: c.event, date: c.date ?? null, impact: c.impact, details: c.details,
    }));

    const detail = {
      currentPrice,
      week52High,
      week52Low,
      peRatio,
      eps,
      freeCashFlow,
      totalRevenue,
      marketCap,
      quarterlyEarnings,
      yearlyEarnings,
      priceHistory,
      investmentSimulation: { initialInvestment: 1000, periodReturns },
      catalysts,
    };

    return new Response(JSON.stringify({ detail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('fetch-stock-detail error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
