const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('Missing LOVABLE_API_KEY');

    const { ticker } = await req.json();
    const sym = String(ticker || '').toUpperCase().slice(0, 6);
    if (!sym) throw new Error('Missing ticker');

    // Get live price for context
    let price = 0;
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const d = await r.json();
      price = d?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
    } catch { /* ignore */ }

    const today = new Date().toISOString().split('T')[0];
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `Today is ${today}. You generate concise, fresh stock alerts based on the most recent real news, market sentiment, or technicals for the given ticker. Be specific and actionable.` },
          { role: 'user', content: `Generate one breaking alert for ${sym}${price ? ` (current ~$${price.toFixed(2)})` : ''}. Use recent news/sentiment.` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_alert',
            description: 'Return a single breaking alert',
            parameters: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Short headline, max 90 chars' },
                note: { type: 'string', description: 'Details: sentiment, reasoning, optional price target. 1-3 sentences.' },
                type: { type: 'string', enum: ['alert', 'buy', 'sell', 'watch'] },
              },
              required: ['title', 'note', 'type'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_alert' } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('AI error', resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: 'Rate limited, try again shortly' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error('AI gateway error');
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error('No alert returned');
    const args = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ ticker: sym, ...args, price }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('breaking-alert error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
