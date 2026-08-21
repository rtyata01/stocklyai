import { writeAppCache } from '../_shared/cache.ts';
import { isValidTicker } from '../_shared/validation.ts';
import { fetchCompanyProfile, fetchYahooRelated, filterTradableTickers, profileBlock } from '../_shared/profile.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchYahooPrice(ticker: string): Promise<number> {
  try {
    const map: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };
    const symbol = map[ticker] || ticker;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' && price > 0 ? price : 0;
  } catch {
    return 0;
  }
}

async function fetchYahooHistory(ticker: string): Promise<{ date: string; close: number }[]> {
  try {
    const map: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };
    const symbol = map[ticker] || ticker;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&range=2y`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    const ts: number[] = r?.timestamp || [];
    const closes: number[] = r?.indicators?.quote?.[0]?.close || [];
    const out: { date: string; close: number }[] = [];
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


async function callAI(messages: any[], tool: any, toolName: string) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages,
      tools: [tool],
      tool_choice: { type: 'function', function: { name: toolName } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('AI gateway error:', res.status, t);
    const err: any = new Error('AI gateway error');
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error('No tool call');
  return JSON.parse(tc.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode: 'compare' | 'market' = body.mode === 'market' ? 'market' : 'compare';
    const rawTickers = Array.isArray(body.tickers) ? body.tickers : [];
    let tickers = Array.from(new Set(
      rawTickers.map((t: any) => String(t || '').trim().toUpperCase()).filter((t: string) => isValidTicker(t))
    )) as string[];

    if (mode === 'compare' && tickers.length < 2) {
      return new Response(JSON.stringify({ error: 'at least 2 valid tickers required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (mode === 'market' && tickers.length !== 1) {
      return new Response(JSON.stringify({ error: 'market mode requires exactly 1 ticker' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Market mode: ask AI for 4 peer tickers in same category, then continue
    if (mode === 'market') {
      const base = tickers[0];
      const [profile, related] = await Promise.all([
        fetchCompanyProfile(base),
        fetchYahooRelated(base),
      ]);
      const peerTool = {
        type: 'function',
        function: {
          name: 'return_peers',
          parameters: {
            type: 'object',
            properties: {
              peers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    ticker: { type: 'string', description: 'US-listed ticker symbol, uppercase' },
                    why: { type: 'string', description: 'Why this is a direct peer, <= 15 words' },
                  },
                  required: ['ticker', 'why'],
                  additionalProperties: false,
                },
                minItems: 4, maxItems: 8,
                description: 'Closest publicly traded peers, ordered best-match first.',
              },
            },
            required: ['peers'], additionalProperties: false,
          },
        },
      };
      const peerResult = await callAI([
        {
          role: 'system',
          content: `You identify the closest publicly traded market peers for a given ticker.
Rules:
- Match the BUSINESS MODEL and strategy first, not just the broad sector. A crypto-treasury company's peers are other crypto-treasury companies (e.g. MSTR, SBET, BMNR, DFDV), not exchanges or miners. A GLP-1 maker's peers are other GLP-1 makers, not all of pharma.
- Prefer companies of comparable size/stage, then larger bellwethers in the identical niche.
- Only real, currently listed US tickers (uppercase, optional . or -). Never invent symbols, never return the base ticker, never return delisted or acquired names.
- Order best match first and return 4-8 candidates so weaker ones can be dropped.`,
        },
        { role: 'user', content: `Find the closest market peers for ${base}.\n\n${profileBlock(profile, base, related)}` },
      ], peerTool, 'return_peers');
      const candidates = (peerResult.peers || [])
        .map((p: any) => String(p?.ticker ?? p ?? '').trim().toUpperCase())
        .filter((p: string) => isValidTicker(p) && p !== base);
      // Backfill with Yahoo's related list, then keep only tickers that actually trade.
      const pool = Array.from(new Set([...candidates, ...related.filter((r) => isValidTicker(r) && r !== base)]));
      const tradable = await filterTradableTickers(pool.slice(0, 12));
      const peers = pool.filter((p) => tradable.has(p)).slice(0, 4);
      tickers = Array.from(new Set([base, ...peers]));
      if (tickers.length < 2) throw new Error('Could not find peers');
    }


    tickers = tickers.slice(0, 8);

    // Fetch live prices + 2y weekly history in parallel
    const [prices, histories] = await Promise.all([
      Promise.all(tickers.map(t => fetchYahooPrice(t))),
      Promise.all(tickers.map(t => fetchYahooHistory(t))),
    ]);
    const priceMap: Record<string, number> = {};
    const historyMap: Record<string, { date: string; close: number }[]> = {};
    tickers.forEach((t, i) => { priceMap[t] = prices[i]; historyMap[t] = histories[i]; });

    const priceList = tickers.map(t => `${t}: $${priceMap[t] > 0 ? priceMap[t].toFixed(2) : 'N/A'}`).join('\n');


    const compareTool = {
      type: 'function',
      function: {
        name: 'return_comparison',
        parameters: {
          type: 'object',
          properties: {
            comparisons: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ticker: { type: 'string' },
                  growth: { type: 'string' },
                  margins: { type: 'string' },
                  tam: { type: 'string' },
                  valuation: { type: 'string' },
                  aiPositioning: { type: 'string' },
                  moat: { type: 'string' },
                  bullPrice: { type: 'number' },
                  bearPrice: { type: 'number' },
                  riskPct: { type: 'number' },
                },
                required: ['ticker', 'growth', 'margins', 'tam', 'valuation', 'aiPositioning', 'moat', 'bullPrice', 'bearPrice', 'riskPct'],
                additionalProperties: false,
              },
            },
            verdict: { type: 'string' },
          },
          required: ['comparisons', 'verdict'],
          additionalProperties: false,
        },
      },
    };

    const parsed = await callAI([
      {
        role: 'system',
        content: `You are a senior equity research analyst doing head-to-head stock comparison. Use the CURRENT MARKET PRICES provided to anchor bull/bear targets. For each ticker:
- growth/margins/tam/valuation/aiPositioning/moat: concise ≤20 word strings each.
- bullPrice: 12-month bull-case target. MUST be ABOVE the provided current price (typically +15% to +80%).
- bearPrice: 12-month bear-case target. MUST be BELOW the provided current price (typically -15% to -50%).
- riskPct: integer 0-100 (0=mega blue chip, 100=speculative).
Also return a "verdict" (≤40 words) ranking risk/reward.
Use REAL, current fundamentals — no stale estimates. Anchor every price to the supplied current price.`,
      },
      { role: 'user', content: `Compare these tickers using current market prices:\n${priceList}` },
    ], compareTool, 'return_comparison');

    // Post-process: ensure bull > current > bear when we have a real price
    const comparisons = (parsed.comparisons || []).map((c: any) => {
      const cur = priceMap[String(c.ticker).toUpperCase()] || 0;
      let bull = Number(c.bullPrice) || 0;
      let bear = Number(c.bearPrice) || 0;
      if (cur > 0) {
        if (!(bull > cur)) bull = +(cur * 1.25).toFixed(2);
        if (!(bear < cur) || bear <= 0) bear = +(cur * 0.75).toFixed(2);
      }
      return { ...c, bullPrice: bull, bearPrice: bear };
    });

    const history = tickers.map(t => ({ ticker: t, points: historyMap[t] || [] }));
    const result = { comparisons, verdict: parsed.verdict, tickers, mode, history, prices: priceMap };


    const key = `stock-comparison:${mode}:${tickers.slice().sort().join(',')}`;
    await writeAppCache(key, result, 6 * 60 * 60 * 1000);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('compare-stocks error:', error);
    if (error?.status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (error?.status === 402) return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
