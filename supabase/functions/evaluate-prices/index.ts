const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { stocks } = await req.json();
    if (!Array.isArray(stocks) || stocks.length === 0) {
      return new Response(JSON.stringify({ error: 'stocks array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const stockList = stocks.map((s: { ticker: string; price: number; sector: string; dayMin: number; dayMax: number; change: number }) =>
      `${s.ticker}: current $${s.price.toFixed(2)}, day range $${s.dayMin.toFixed(2)}-$${s.dayMax.toFixed(2)}, change ${s.change.toFixed(2)}%, sector: ${s.sector}`
    ).join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a senior equity research analyst. For each stock or asset, determine realistic fair value price targets for Buy, Hold, and Sell zones based on:

1. **Analyst consensus target prices** — use well-known Wall Street consensus estimates as your primary reference.
2. **Valuation fundamentals** — consider P/E, P/S, growth rates, and sector multiples.
3. **Technical levels** — recent support/resistance, 52-week range context.

CRITICAL RULES:
- Buy price should be a realistic discount to current price where it becomes attractive — typically 5-20% below current price depending on volatility and valuation.
- Hold price should be approximately the current fair value — close to the current market price or analyst consensus target.
- Sell price should be a realistic upside target — typically 10-30% above current price, aligned with analyst price targets.
- For crypto assets (ETH, SOL, XRP, BITF, BMNR), use crypto-specific valuation (market cycles, adoption metrics).
- For ETFs (SPY, VOO), use index-level targets based on earnings estimates.
- NEVER return a buy price that is more than 30% below current price unless the stock is fundamentally overvalued by analyst consensus.
- All prices must be in USD and make sense relative to the current trading price provided.`
          },
          {
            role: 'user',
            content: `Provide buy, hold, and sell fair value targets for each:\n\n${stockList}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_price_evaluations',
              description: 'Return buy/hold/sell price evaluations for stocks',
              parameters: {
                type: 'object',
                properties: {
                  evaluations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        buyPrice: { type: 'number', description: 'Attractive entry price, typically 5-20% below current' },
                        holdPrice: { type: 'number', description: 'Fair value / consensus target, near current price' },
                        salePrice: { type: 'number', description: 'Upside target, typically 10-30% above current' },
                      },
                      required: ['ticker', 'buyPrice', 'holdPrice', 'salePrice'],
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
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
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
    return new Response(JSON.stringify({ evaluations: parsed.evaluations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('evaluate-prices error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
