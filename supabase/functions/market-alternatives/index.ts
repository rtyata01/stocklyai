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

const CATEGORY_KEYS = ['cheaper', 'higherGrowth', 'lowerRisk', 'bestCompetitors'] as const;

const itemSchema = {
  type: 'object',
  properties: {
    ticker: { type: 'string', description: 'US-listed ticker symbol, uppercase' },
    name: { type: 'string', description: 'Company or fund name' },
    reason: { type: 'string', description: 'Why this fits the category, <= 22 words, cite a real metric' },
    metric: { type: 'string', description: 'Single headline metric, e.g. "Fwd P/E 18 vs 34" or "Rev +42% YoY"' },
  },
  required: ['ticker', 'name', 'reason', 'metric'],
  additionalProperties: false,
};

const categoryArray = (desc: string) => ({
  type: 'array',
  minItems: 2,
  maxItems: 4,
  description: desc,
  items: itemSchema,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const ticker = String(body?.ticker || '').trim().toUpperCase();
    if (!isValidTicker(ticker)) {
      return new Response(JSON.stringify({ error: 'a single valid ticker is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const basePrice = await fetchYahooPrice(ticker);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const tool = {
      type: 'function',
      function: {
        name: 'return_alternatives',
        parameters: {
          type: 'object',
          properties: {
            cheaper: categoryArray('Cheaper alternatives — similar exposure at a materially lower valuation (P/E, EV/S, P/B).'),
            higherGrowth: categoryArray('Higher-growth alternatives — faster revenue/earnings growth, accepting more volatility.'),
            lowerRisk: categoryArray('Lower-risk alternatives — steadier balance sheet, lower beta, or a diversified ETF with similar exposure.'),
            bestCompetitors: categoryArray('Best competitors — direct rivals competing for the same customers/market share.'),
            summary: { type: 'string', description: 'One-sentence takeaway, <= 35 words.' },
          },
          required: [...CATEGORY_KEYS, 'summary'],
          additionalProperties: false,
        },
      },
    };

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a senior equity research analyst. Given one ticker, surface investable alternatives across four buckets: cheaper, higher-growth, lower-risk, and best competitors. Only return real, currently listed US tickers (or major ETFs). Never repeat the base ticker. Use real, recent fundamentals — no invented numbers.',
          },
          {
            role: 'user',
            content: `Base ticker: ${ticker}${basePrice > 0 ? ` (current price $${basePrice.toFixed(2)})` : ''}. Return alternatives for each bucket.`,
          },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'return_alternatives' } },
      }),
    });

    if (!res.ok) {
      const status = res.status;
      console.error('AI gateway error:', status, await res.text());
      if (status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (status === 402) return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error('AI gateway error');
    }

    const data = await res.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) throw new Error('No tool call in response');
    const parsed = JSON.parse(tc.function.arguments);

    // Sanitize and collect tickers for live pricing
    const categories: Record<string, any[]> = {};
    const seen = new Set<string>();
    for (const key of CATEGORY_KEYS) {
      const items = Array.isArray(parsed[key]) ? parsed[key] : [];
      categories[key] = items
        .map((it: any) => ({
          ticker: String(it?.ticker || '').trim().toUpperCase(),
          name: String(it?.name || ''),
          reason: String(it?.reason || ''),
          metric: String(it?.metric || ''),
        }))
        .filter((it: any) => isValidTicker(it.ticker) && it.ticker !== ticker)
        .slice(0, 4);
      for (const it of categories[key]) seen.add(it.ticker);
    }

    const altTickers = Array.from(seen).slice(0, 24);
    const altPrices = await Promise.all(altTickers.map((t) => fetchYahooPrice(t)));
    const prices: Record<string, number> = { [ticker]: basePrice };
    altTickers.forEach((t, i) => { prices[t] = altPrices[i]; });

    const result = {
      base: ticker,
      basePrice,
      prices,
      summary: String(parsed.summary || ''),
      ...categories,
    };

    await writeAppCache(`market-alternatives:${ticker}`, result, 6 * 60 * 60 * 1000);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('market-alternatives error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
