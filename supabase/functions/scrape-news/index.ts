import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Delete old entries
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('stock_news').delete().lt('published_at', sevenDaysAgo);

    // Get tickers from request body or use defaults
    let tickers: string[];
    try {
      const body = await req.json();
      tickers = body.tickers || [];
    } catch {
      tickers = [];
    }

    if (tickers.length === 0) {
      tickers = [
        "SPY", "VOO", "GOOGL", "MSFT", "AAPL", "AMZN", "META", "TSLA",
        "NVDA", "AMD", "MU", "SMCI", "PLTR", "CRWV", "NBIS", "BBAI", "APLD",
        "SOFI", "HOOD", "COIN", "MSTR", "RGTI", "QBTS", "ACHR", "JOBY",
        "RZLV", "NTLA", "CRSP", "BITF", "BMNR", "RR", "TLX"
      ];
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
            content: `You are an expert earnings momentum trader and analyst. Your job is to identify the single best stock for an earnings momentum trade from the given ticker list.

Criteria for the #1 pick:
1. Earnings date is within the NEXT 2-3 weeks from today (${today})
2. Strong expectation to BEAT analyst EPS estimates (whisper numbers, recent guidance raises, sector tailwinds)
3. Forecast for strong revenue/earnings growth in the following quarter
4. Risk-to-reward ratio of approximately 1:2 (limited downside, 2x upside potential)
5. Good for a short-term earnings momentum trade (buy before earnings, ride the beat)

Provide ONLY the single best pick. Be specific with numbers: expected EPS vs consensus, earnings date, price target, stop loss, and why this stock will beat.
If no stock meets all criteria strongly, pick the closest match and note caveats.`
          },
          {
            role: 'user',
            content: `From these tickers, identify the #1 earnings momentum trade for the next 2-3 weeks: ${tickers.join(', ')}. Today is ${today}.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_earnings_pick',
              description: 'Return the top earnings momentum stock pick',
              parameters: {
                type: 'object',
                properties: {
                  pick: {
                    type: 'object',
                    properties: {
                      ticker: { type: 'string', description: 'Stock ticker symbol' },
                      earnings_date: { type: 'string', description: 'Expected earnings date (YYYY-MM-DD)' },
                      consensus_eps: { type: 'number', description: 'Wall Street consensus EPS estimate' },
                      expected_eps: { type: 'number', description: 'Your expected actual EPS (whisper number)' },
                      beat_confidence: { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'Confidence level the stock will beat' },
                      entry_price: { type: 'number', description: 'Suggested entry price' },
                      price_target: { type: 'number', description: 'Price target after earnings beat' },
                      stop_loss: { type: 'number', description: 'Stop loss price' },
                      risk_reward_ratio: { type: 'string', description: 'Risk to reward ratio e.g. 1:2.1' },
                      headline: { type: 'string', description: 'Compelling one-line headline for the trade' },
                      thesis: { type: 'string', description: 'Detailed 2-3 sentence bull thesis explaining why this stock will beat and rally' },
                      catalysts: { type: 'array', items: { type: 'string' }, description: '3-4 key catalysts' },
                      risks: { type: 'array', items: { type: 'string' }, description: '2-3 key risks' },
                      next_quarter_growth: { type: 'string', description: 'Expected revenue/earnings growth outlook for the quarter after earnings' },
                    },
                    required: ['ticker', 'earnings_date', 'consensus_eps', 'expected_eps', 'beat_confidence', 'entry_price', 'price_target', 'stop_loss', 'risk_reward_ratio', 'headline', 'thesis', 'catalysts', 'risks', 'next_quarter_growth'],
                  },
                },
                required: ['pick'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_earnings_pick' } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error('AI error:', response.status, t);
      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in response');

    const parsed = JSON.parse(toolCall.function.arguments);
    const pick = parsed.pick;

    // Build a rich summary from the structured data
    const summary = JSON.stringify({
      earnings_date: pick.earnings_date,
      consensus_eps: pick.consensus_eps,
      expected_eps: pick.expected_eps,
      beat_confidence: pick.beat_confidence,
      entry_price: pick.entry_price,
      price_target: pick.price_target,
      stop_loss: pick.stop_loss,
      risk_reward_ratio: pick.risk_reward_ratio,
      thesis: pick.thesis,
      catalysts: pick.catalysts,
      risks: pick.risks,
      next_quarter_growth: pick.next_quarter_growth,
    });

    // Clear existing and insert the single pick
    await supabase.from('stock_news').delete().gte('created_at', sevenDaysAgo);

    const { error: insertError } = await supabase.from('stock_news').insert({
      ticker: pick.ticker,
      headline: pick.headline,
      summary: summary,
      is_fda_related: false,
      published_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true, pick: pick.ticker }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('scrape-news error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
