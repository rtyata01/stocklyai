import { writeAppCache } from '../_shared/cache.ts';
import { isValidTicker, MAX_TICKERS } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tickers: rawTickers } = await req.json();
    if (!Array.isArray(rawTickers) || rawTickers.length < 2) {
      return new Response(JSON.stringify({ error: 'at least 2 tickers required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const tickers = Array.from(new Set(
      rawTickers
        .map((t: any) => String(t || '').trim().toUpperCase())
        .filter((t: string) => isValidTicker(t))
    )).slice(0, Math.min(MAX_TICKERS, 8));
    if (tickers.length < 2) {
      return new Response(JSON.stringify({ error: 'at least 2 valid tickers required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `You are a senior equity research analyst specializing in side-by-side stock comparison. For each ticker provided, produce a CONCISE comparable analysis across these dimensions:
- growth: revenue/EPS growth profile (trailing + forward), ≤20 words.
- margins: gross/operating/FCF margin profile and trend, ≤20 words.
- tam: total addressable market size and expansion potential, ≤20 words.
- valuation: P/E, PEG, P/S vs peers — over/fairly/undervalued, ≤20 words.
- aiPositioning: how the company is positioned in the AI wave (infra, model, application, none), ≤20 words.
- moat: competitive moat (network effects, switching costs, IP, scale), ≤20 words.
- bullPrice: 12-month bull-case price target (USD).
- bearPrice: 12-month bear-case price target (USD).
- riskPct: integer 0-100 overall risk (0=mega blue chip, 100=speculative).

Also produce a final "verdict" (≤40 words) ranking the comparison and recommending which has best risk/reward.`,
          },
          { role: 'user', content: `Compare these tickers head-to-head: ${tickers.join(', ')}` },
        ],
        tools: [{
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
        }],
        tool_choice: { type: 'function', function: { name: 'return_comparison' } },
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

    const key = `stock-comparison:${tickers.sort().join(',')}`;
    await writeAppCache(key, parsed, 12 * 60 * 60 * 1000);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('compare-stocks error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
