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

    const stockList = stocks.map((s: { ticker: string; price: number; sector: string }) =>
      `${s.ticker} (sector: ${s.sector}, current price: $${s.price.toFixed(2)})`
    ).join('\n');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a stock analyst. For each stock, provide fair value estimates for buy, hold, and sell price points based on general market knowledge. Return ONLY valid JSON array with objects containing: ticker, buyPrice, holdPrice, salePrice (all numbers). No explanation, no markdown.`
          },
          {
            role: 'user',
            content: `Evaluate fair buy, hold, and sell prices for these stocks:\n${stockList}`
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
                        buyPrice: { type: 'number' },
                        holdPrice: { type: 'number' },
                        salePrice: { type: 'number' },
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
