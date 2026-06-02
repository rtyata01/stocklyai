import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sanitizeTickers } from '../_shared/validation.ts';

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

    let rawTickers: string[] = [];
    try {
      const body = await req.json();
      rawTickers = body.tickers || [];
    } catch {
      rawTickers = [];
    }

    let tickers = sanitizeTickers(rawTickers);
    if (tickers.length === 0) {
      tickers = [
        "SPY", "VOO", "GOOGL", "MSFT", "AAPL", "AMZN", "META", "TSLA",
        "NVDA", "AMD", "MU", "SMCI", "PLTR", "CRWV", "NBIS", "BBAI", "APLD",
        "SOFI", "HOOD", "COIN", "MSTR", "RGTI", "QBTS", "ACHR", "JOBY",
        "RZLV", "NTLA", "CRSP", "BITF", "BMNR", "RR", "TLX", "NNE", "OKLO"
      ];
    }

    const today = new Date().toISOString().split('T')[0];

    // Fetch real current prices so picks anchor to live market data, not stale AI estimates
    async function fetchYahooPrice(ticker: string): Promise<number> {
      try {
        const map: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };
        const symbol = map[ticker] || ticker;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await r.json();
        const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        return typeof p === 'number' && p > 0 ? p : 0;
      } catch { return 0; }
    }
    const livePrices: Record<string, number> = {};
    const priceResults = await Promise.all(tickers.map(t => fetchYahooPrice(t)));
    tickers.forEach((t, i) => { livePrices[t] = priceResults[i]; });
    const priceList = tickers
      .filter(t => livePrices[t] > 0)
      .map(t => `${t}: $${livePrices[t].toFixed(2)}`)
      .join('\n');

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
            content: `You are an expert earnings momentum trader and analyst. Your job is to identify the TOP stocks (up to 5, but ONLY those that truly qualify) for earnings momentum trades from the given ticker list.

STRICT Criteria — a stock MUST meet ALL of these to be included:
1. Earnings date is within the NEXT 2-3 weeks from today (${today})
2. Strong expectation to BEAT analyst EPS estimates (whisper numbers, recent guidance raises, sector tailwinds)
3. Forecast for strong revenue/earnings growth in the following quarter
4. Risk-to-reward ratio of AT LEAST 1:2 (limited downside, 2x+ upside potential)
5. Good for a short-term earnings momentum trade (buy before earnings, ride the beat)

PRICE LEVELS — MUST be anchored to the REAL CURRENT MARKET PRICES PROVIDED BELOW. Do NOT invent or use stale prices:
- "current_price": MUST match the provided live price for the ticker exactly.
- "entry_price" (BUY zone): 2-8% BELOW current_price. Must be <= current_price.
- "price_target" (SELL zone): 10-30% ABOVE current_price, aligned with analyst consensus.
- "stop_loss": Below entry_price; (price_target - entry_price) / (entry_price - stop_loss) MUST be >= 2.0.

IMPORTANT RULES:
- Return ONLY stocks that genuinely have earnings in the next 2-3 weeks
- If only 1-2 stocks meet all criteria, return only those. Do NOT pad to 5.
- Maximum 5 picks. Minimum 1.
- Rank by confidence (highest first)`
          },
          {
            role: 'user',
            content: `Today is ${today}. Use these REAL live prices to anchor all price levels:\n${priceList}\n\nFrom these tickers, identify the best earnings momentum trades for the next 2-3 weeks: ${tickers.join(', ')}. Return ONLY those that truly qualify (1-5 picks).`
          }
        ],

        tools: [
          {
            type: 'function',
            function: {
              name: 'return_earnings_picks',
              description: 'Return the top earnings momentum stock picks (1-5)',
              parameters: {
                type: 'object',
                properties: {
                  picks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        earnings_date: { type: 'string', description: 'YYYY-MM-DD' },
                        consensus_eps: { type: 'number' },
                        expected_eps: { type: 'number' },
                        beat_confidence: { type: 'string', enum: ['High', 'Medium', 'Low'] },
                        current_price: { type: 'number', description: "Today's actual market price" },
                        entry_price: { type: 'number', description: 'BUY zone, 2-8% below current_price' },
                        price_target: { type: 'number', description: 'SELL zone, 10-30% above current_price' },
                        stop_loss: { type: 'number', description: 'Max downside, below entry_price' },
                        risk_reward_ratio: { type: 'string' },
                        headline: { type: 'string' },
                        thesis: { type: 'string' },
                        catalysts: { type: 'array', items: { type: 'string' } },
                        risks: { type: 'array', items: { type: 'string' } },
                        next_quarter_growth: { type: 'string' },
                      },
                      required: ['ticker', 'earnings_date', 'consensus_eps', 'expected_eps', 'beat_confidence', 'current_price', 'entry_price', 'price_target', 'stop_loss', 'risk_reward_ratio', 'headline', 'thesis', 'catalysts', 'risks', 'next_quarter_growth'],
                    },
                    minItems: 1,
                    maxItems: 5,
                  },
                },
                required: ['picks'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_earnings_picks' } },
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
    const picks = parsed.picks;

    if (!Array.isArray(picks) || picks.length === 0) {
      throw new Error('No qualifying picks found');
    }

    // Clear existing picks
    await supabase.from('stock_news').delete().gte('created_at', sevenDaysAgo);

    // Insert all picks — override current_price with live Yahoo price and rescale levels
    const inserts = picks.map((pick: any, index: number) => {
      const live = livePrices[String(pick.ticker || '').toUpperCase()] || 0;
      const aiCurrent = Number(pick.current_price) || 0;
      let current = live > 0 ? live : aiCurrent;
      let entry = Number(pick.entry_price) || 0;
      let target = Number(pick.price_target) || 0;
      let stop = Number(pick.stop_loss) || 0;
      // If we have a live price and AI quoted a different current, scale levels proportionally
      if (live > 0 && aiCurrent > 0 && Math.abs(live - aiCurrent) / aiCurrent > 0.02) {
        const r = live / aiCurrent;
        entry = +(entry * r).toFixed(2);
        target = +(target * r).toFixed(2);
        stop = +(stop * r).toFixed(2);
        current = live;
      }
      // Safety: enforce stop < entry <= current < target
      if (!(entry > 0 && entry <= current)) entry = +(current * 0.95).toFixed(2);
      if (!(target > current)) target = +(current * 1.15).toFixed(2);
      if (!(stop > 0 && stop < entry)) stop = +(entry * 0.93).toFixed(2);
      const rr = ((target - entry) / Math.max(0.01, entry - stop)).toFixed(2);
      return {
        ticker: pick.ticker,
        headline: pick.headline,
        summary: JSON.stringify({
          rank: index + 1,
          earnings_date: pick.earnings_date,
          consensus_eps: pick.consensus_eps,
          expected_eps: pick.expected_eps,
          beat_confidence: pick.beat_confidence,
          current_price: current,
          entry_price: entry,
          price_target: target,
          stop_loss: stop,
          risk_reward_ratio: `1:${rr}`,
          thesis: pick.thesis,
          catalysts: pick.catalysts,
          risks: pick.risks,
          next_quarter_growth: pick.next_quarter_growth,
        }),
        is_fda_related: false,
        published_at: new Date().toISOString(),
      };
    });


    const { error: insertError } = await supabase.from('stock_news').insert(inserts);

    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true, count: picks.length, tickers: picks.map((p: any) => p.ticker) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('scrape-news error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
