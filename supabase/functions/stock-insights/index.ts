import { writeAppCache } from '../_shared/cache.ts';
import { isValidTicker, MAX_TICKERS } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { stocks: rawStocks } = await req.json();
    if (!Array.isArray(rawStocks) || rawStocks.length === 0) {
      return new Response(JSON.stringify({ error: 'stocks array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const stocks = rawStocks
      .filter((s: any) => s && isValidTicker(String(s.ticker || '').toUpperCase()))
      .slice(0, MAX_TICKERS)
      .map((s: any) => ({
        ticker: String(s.ticker).toUpperCase(),
        price: Number(s.price) || 0,
        sector: String(s.sector || 'Other').slice(0, 40).replace(/[^A-Za-z0-9 &.\-]/g, ''),
      }));
    if (stocks.length === 0) {
      return new Response(JSON.stringify({ error: 'no valid stocks' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const stockList = stocks.map(s => `${s.ticker} ($${s.price.toFixed(2)}, ${s.sector})`).join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a senior equity research analyst. For each ticker, return:
- isKing (boolean): true ONLY if the company is a clear current OR emerging future king/queen of its category — i.e. dominant market share, near-monopoly, structural moat, or undisputed leader of its emerging category (e.g. NVDA in AI chips, GOOGL in search, MSFT in enterprise SaaS, AAPL in premium devices, PLTR in defense AI, COIN in US crypto exchange, ETH in smart contracts, OKLO in SMR nuclear, ASML in EUV). Be selective. False for commodity/me-too names.
- dominanceReason (string, ≤25 words): If isKing, ONE concise reason citing share, moat, monopoly, or category leadership. If not king, empty string.
- bullPrice (number): 12-month bull-case target (optimistic but defensible, typically +20% to +80% above current).
- bearPrice (number): 12-month bear-case target (downside if thesis breaks, typically -15% to -50% below current).
- riskPct (integer 0-100): overall risk score. 0-20=very low (mega-cap blue chips), 21-40=low, 41-60=moderate, 61-80=high (small-cap growth), 81-100=very high (speculative/pre-revenue).`,
          },
          { role: 'user', content: `Analyze:\n${stockList}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_insights',
            description: 'Return dominance and bull/bear/risk insights',
            parameters: {
              type: 'object',
              properties: {
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ticker: { type: 'string' },
                      isKing: { type: 'boolean' },
                      dominanceReason: { type: 'string' },
                      bullPrice: { type: 'number' },
                      bearPrice: { type: 'number' },
                      riskPct: { type: 'number' },
                    },
                    required: ['ticker', 'isKing', 'dominanceReason', 'bullPrice', 'bearPrice', 'riskPct'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['insights'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_insights' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (response.status === 402) return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in response');
    const parsed = JSON.parse(toolCall.function.arguments);

    const key = `stock-insights:${stocks.map(s => s.ticker).sort().join(',')}`;
    await writeAppCache(key, { insights: parsed.insights }, 24 * 60 * 60 * 1000);

    return new Response(JSON.stringify({ insights: parsed.insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('stock-insights error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
