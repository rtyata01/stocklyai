import { isValidTicker } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };

interface Source { title: string; url: string; publisher: string; publishedAt: string | null }

async function fetchNews(sym: string): Promise<Source[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(sym)}&newsCount=8&quotesCount=0`,
      { headers: UA },
    );
    if (!r.ok) return [];
    const j = await r.json();
    const news = Array.isArray(j?.news) ? j.news : [];
    return news
      .filter((n: any) => n?.title && n?.link)
      .slice(0, 6)
      .map((n: any) => ({
        title: String(n.title),
        url: String(n.link),
        publisher: String(n.publisher ?? 'Yahoo Finance'),
        publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
      }));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('Missing LOVABLE_API_KEY');

    const body = await req.json().catch(() => ({}));
    const rawTicker = typeof body?.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    if (!isValidTicker(rawTicker)) {
      return new Response(JSON.stringify({ error: 'Invalid ticker' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const sym = rawTicker;

    // Get live price + real recent headlines for context
    let price = 0;
    const [priceRes, sources] = await Promise.all([
      (async () => {
        try {
          const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, { headers: UA });
          const d = await r.json();
          return d?.chart?.result?.[0]?.meta?.regularMarketPrice || 0;
        } catch { return 0; }
      })(),
      fetchNews(sym),
    ]);
    price = priceRes;

    const today = new Date().toISOString().split('T')[0];
    const headlineCtx = sources.length
      ? `Recent real headlines (use these as the factual basis; do not invent events):\n${sources.map((s, i) => `${i + 1}. ${s.title} — ${s.publisher}`).join('\n')}`
      : 'No recent headlines available; base the alert on general sentiment and technicals and say so.';

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `Today is ${today}. You generate concise, fresh stock alerts grounded in the supplied real headlines. Be specific and actionable. Never fabricate events or URLs.` },
          { role: 'user', content: `Generate one breaking alert for ${sym}${price ? ` (current ~$${price.toFixed(2)})` : ''}.\n\n${headlineCtx}` },
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
                note: { type: 'string', description: 'Summary: sentiment, reasoning, optional price target. 1-3 sentences.' },
                details: { type: 'string', description: 'Full context: what happened, why it matters, market reaction, what to watch next. 4-8 sentences.' },
                impact: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
                keyPoints: { type: 'array', items: { type: 'string' }, description: '3-5 short bullet points of key facts / drivers.' },
                type: { type: 'string', enum: ['alert', 'buy', 'sell', 'watch'] },
              },
              required: ['title', 'note', 'details', 'impact', 'keyPoints', 'type'],
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

    return new Response(JSON.stringify({ ticker: sym, ...args, price, sources }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('breaking-alert error', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
