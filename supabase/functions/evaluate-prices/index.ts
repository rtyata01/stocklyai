import { writeAppCache, readAppCacheStale } from '../_shared/cache.ts';
import { aiFetch } from '../_shared/aiFetch.ts';
import { isValidTicker, MAX_TICKERS } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { stocks: rawStocks } = await req.json();
    if (!Array.isArray(rawStocks) || rawStocks.length === 0) {
      return new Response(JSON.stringify({ error: 'stocks array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Validate + cap to prevent prompt injection / credit drain
    const stocks = rawStocks
      .filter((s: any) => s && isValidTicker(String(s.ticker || '').toUpperCase()))
      .slice(0, MAX_TICKERS)
      .map((s: any) => ({
        ticker: String(s.ticker).toUpperCase(),
        price: Number(s.price) || 0,
        dayMin: Number(s.dayMin) || 0,
        dayMax: Number(s.dayMax) || 0,
        change: Number(s.change) || 0,
        sector: String(s.sector || 'Other').slice(0, 40).replace(/[^A-Za-z0-9 &.\-]/g, ''),
      }));
    if (stocks.length === 0) {
      return new Response(JSON.stringify({ error: 'no valid stocks' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const stockList = stocks.map((s) =>
      `${s.ticker}: current $${s.price.toFixed(2)}, day range $${s.dayMin.toFixed(2)}-$${s.dayMax.toFixed(2)}, change ${s.change.toFixed(2)}%, sector: ${s.sector}`
    ).join('\n');

    const response = await aiFetch({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a senior equity research analyst. For each stock or asset, compute Buy / Hold / Sell fair-value price targets using a MULTI-METHOD blended approach. Combine these signals and use the aggregate (average or median) of valid methods, with safety guardrails:

METHOD 1 — Analyst consensus & technicals (baseline)
  - Wall Street consensus 12-month target.
  - 52-week range support/resistance.

METHOD 2 — Intrinsic value from fundamentals
  - Use trailing/forward quarterly REVENUE GROWTH and PROFIT MARGIN to estimate intrinsic value per share.
  - Approximate: intrinsic ≈ (forward EPS × peer-median forward P/E adjusted for growth-vs-peers).
  - Rule: current price < intrinsic → Buy zone, ≈ intrinsic → Hold, > intrinsic → Sell zone.

METHOD 3 — PEG ratio (growth vs price)
  - PEG = P/E ÷ expected EPS growth %.
  - PEG < 1.0 → undervalued (Buy bias). PEG ≈ 1.0 → fair (Hold). PEG > 1.5 → expensive (Sell bias).

METHOD 4 — Safety & sentiment guardrails
  - BUY price MUST be at least 15-30% below current fair value / recent peak (margin of safety).
  - SELL price should reflect 15-30% above fair value or a stretched extension above last week's average.
  - Adjust ±5-10% for short-term sentiment (breaking news, hype, unusual volume, momentum).

AGGREGATION RULES:
  - For each of buy/hold/sell, compute estimates from each applicable method, then take the MEDIAN (or average if only 2 methods apply). This produces the final price.
  - For crypto (ETH, SOL, XRP, BITF, BMNR): skip P/E/PEG, use cycle position + adoption + recent volatility.
  - For ETFs (SPY, VOO): use index earnings yield and forward P/E of the underlying index.

OUTPUT REQUIREMENTS:
  - buyPrice: aggregated buy zone (must be ≤ current price, typically 5-25% below).
  - holdPrice: fair value / consensus center (within ±5% of current price typically).
  - salePrice: aggregated sell zone (must be ≥ current price, typically 10-30% above).
  - reasoning: ONE concise sentence (≤ 30 words) describing the dominant signals (e.g. "PEG 0.8 + 12% revenue growth + analyst target $190 → undervalued vs current.").
  - All prices in USD, internally consistent: buyPrice < holdPrice ≤ salePrice.`
          },
          {
            role: 'user',
            content: `Compute multi-method buy/hold/sell fair value targets for each:\n\n${stockList}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_price_evaluations',
              description: 'Return buy/hold/sell price evaluations with reasoning',
              parameters: {
                type: 'object',
                properties: {
                  evaluations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        buyPrice: { type: 'number', description: 'Aggregated buy zone, typically 5-25% below current' },
                        holdPrice: { type: 'number', description: 'Aggregated fair value / consensus, near current price' },
                        salePrice: { type: 'number', description: 'Aggregated sell zone, typically 10-30% above current' },
                        reasoning: { type: 'string', description: 'Short ≤30-word justification citing the dominant signals (PEG, growth, intrinsic vs price, sentiment).' },
                      },
                      required: ['ticker', 'buyPrice', 'holdPrice', 'salePrice', 'reasoning'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['evaluations'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_price_evaluations' } },
    }, LOVABLE_API_KEY);

    if (!response.ok) {
      if (response.status === 429) {
        const stale = await readAppCacheStale(`price-evaluations:${stocks.map(s => s.ticker).sort().join(',')}`);
        if (stale?.evaluations) {
          return new Response(JSON.stringify({ ...stale, stale: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in response');

    const parsed = JSON.parse(toolCall.function.arguments);
    const tickerKey = stocks.map((s: { ticker: string }) => s.ticker).sort().join(',');
    await writeAppCache(`price-evaluations:${tickerKey}`, { evaluations: parsed.evaluations }, 24 * 60 * 60 * 1000);
    return new Response(JSON.stringify({ evaluations: parsed.evaluations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('evaluate-prices error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
