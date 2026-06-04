import { writeAppCache } from '../_shared/cache.ts';
import { isValidTicker } from '../_shared/validation.ts';

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
      const peerTool = {
        type: 'function',
        function: {
          name: 'return_peers',
          parameters: {
            type: 'object',
            properties: {
              peers: {
                type: 'array',
                items: { type: 'string' },
                minItems: 3, maxItems: 4,
                description: 'Publicly traded peer tickers in the same market/category as the base ticker. US-listed preferred.',
              },
            },
            required: ['peers'], additionalProperties: false,
          },
        },
      };
      const peerResult = await callAI([
        { role: 'system', content: 'You identify the closest publicly traded market peers/competitors for a given ticker. Return 3-4 most relevant peer tickers (same industry, similar size or direct competitor). Return only valid US-listed ticker symbols (uppercase letters, optional . or -).' },
        { role: 'user', content: `Find 3-4 closest market peers for ${base}.` },
      ], peerTool, 'return_peers');
      const peers = (peerResult.peers || [])
        .map((p: any) => String(p || '').trim().toUpperCase())
        .filter((p: string) => isValidTicker(p) && p !== base)
        .slice(0, 4);
      tickers = Array.from(new Set([base, ...peers]));
      if (tickers.length < 2) throw new Error('Could not find peers');
    }

    tickers = tickers.slice(0, 8);

    // Fetch live prices for accurate anchoring
    const prices = await Promise.all(tickers.map(t => fetchYahooPrice(t)));
    const priceMap: Record<string, number> = {};
    tickers.forEach((t, i) => { priceMap[t] = prices[i]; });

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

    const result = { comparisons, verdict: parsed.verdict, tickers, mode };

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
