import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing environment variables');
    }

    let tickers: string[] = [];
    try {
      const body = await req.json();
      tickers = body.tickers || [];
    } catch {
      tickers = [];
    }

    const today = new Date().toISOString().split('T')[0];

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
            content: `You are an expert short-term swing trader. Today is ${today}.

Find SHORT-TERM swing trade signals (1 day to 2 weeks holding) from RECENT news (last 7 days). DO NOT include earnings momentum trades — those are covered separately.

Focus on these signal categories:
1. FDA_APPROVAL — biotech/pharma stock got FDA approval, breakthrough designation, or positive PDUFA. These typically rally 1+ week.
2. CONTRACT_WIN — major government / enterprise contract awarded.
3. ANALYST_UPGRADE — multiple major analyst upgrades or significant price target hike (>20%).
4. PRODUCT_LAUNCH — major product launch / breakthrough announcement causing momentum.
5. INSIDER_BUYING — significant cluster of insider buys.
6. SHORT_SQUEEZE — high short interest + bullish catalyst building.
7. SECTOR_TAILWIND — macro/regulatory event lifting the whole sector (e.g. crypto regulation, AI executive order, defense spending).
8. TECHNICAL_BREAKOUT — confirmed breakout above multi-month resistance with volume.

Return 3-8 of the BEST current swing trade setups. Include the ticker, signal_type, what happened, why it matters short-term, entry/target/stop levels relative to today's price, expected holding period in days, and confidence.

Watchlist tickers (prioritize but include other strong signals too): ${tickers.join(', ')}`,
          },
          {
            role: 'user',
            content: `Find the best 3-8 short-term swing trade signals active right now (excluding earnings momentum). Today is ${today}.`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_swing_signals',
              description: 'Return short-term swing trade signals',
              parameters: {
                type: 'object',
                properties: {
                  signals: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        company_name: { type: 'string' },
                        signal_type: {
                          type: 'string',
                          enum: ['FDA_APPROVAL', 'CONTRACT_WIN', 'ANALYST_UPGRADE', 'PRODUCT_LAUNCH', 'INSIDER_BUYING', 'SHORT_SQUEEZE', 'SECTOR_TAILWIND', 'TECHNICAL_BREAKOUT'],
                        },
                        headline: { type: 'string' },
                        event_date: { type: 'string', description: 'YYYY-MM-DD' },
                        details: { type: 'string', description: 'What happened in 2-3 sentences. For FDA: drug name, indication, market size.' },
                        why_it_matters: { type: 'string', description: 'Why this drives short-term price up' },
                        current_price: { type: 'number' },
                        entry_price: { type: 'number' },
                        target_price: { type: 'number' },
                        stop_loss: { type: 'number' },
                        holding_days: { type: 'number', description: 'Expected holding period in days (1-14)' },
                        confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                        source_url: { type: 'string' },
                      },
                      required: ['ticker', 'company_name', 'signal_type', 'headline', 'event_date', 'details', 'why_it_matters', 'current_price', 'entry_price', 'target_price', 'stop_loss', 'holding_days', 'confidence'],
                    },
                    minItems: 1,
                    maxItems: 8,
                  },
                },
                required: ['signals'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_swing_signals' } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error('AI error:', response.status, t);
      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let signals: unknown[] = [];

    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        signals = parsed.signals ?? [];
      } catch (e) {
        console.error('Failed to parse tool arguments:', e);
      }
    } else {
      // Fallback: try to extract JSON from message content
      const content = aiData.choices?.[0]?.message?.content;
      console.warn('No tool call returned. Content:', content?.slice?.(0, 300));
      if (typeof content === 'string') {
        const match = content.match(/\{[\s\S]*"signals"[\s\S]*\}/);
        if (match) {
          try {
            signals = JSON.parse(match[0]).signals ?? [];
          } catch {}
        }
      }
    }

    return new Response(JSON.stringify({ signals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('scrape-swing-signals error:', msg);
    // Return 200 with empty signals so the UI doesn't blank-screen
    return new Response(JSON.stringify({ signals: [], error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
