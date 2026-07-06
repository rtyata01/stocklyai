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
    let horizon: 'short' | 'mid' = 'short';
    try {
      const body = await req.json();
      rawTickers = body.tickers || [];
      if (body.horizon === 'mid') horizon = 'mid';
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
    const nowMs = Date.now();
    const windowStartDays = horizon === 'mid' ? 21 : 0;
    const windowEndDays = horizon === 'mid' ? 60 : 21;
    const windowStartMs = nowMs + windowStartDays * 24 * 60 * 60 * 1000;
    const horizonMs = nowMs + windowEndDays * 24 * 60 * 60 * 1000;
    const horizonLabel = horizon === 'mid' ? 'Next 1-2 Months' : 'Next 2-3 Weeks';

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

    async function fetchEarningsDate(ticker: string): Promise<string | null> {
      try {
        const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents`;
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) return null;
        const d = await r.json();
        const dates: any[] = d?.quoteSummary?.result?.[0]?.calendarEvents?.earnings?.earningsDate || [];
        for (const e of dates) {
          const raw = typeof e === 'object' && e ? (e.raw ?? e) : e;
          const ms = typeof raw === 'number' ? raw * 1000 : Date.parse(String(raw));
          if (Number.isFinite(ms) && ms >= windowStartMs - 24*3600*1000 && ms <= horizonMs) {
            return new Date(ms).toISOString().split('T')[0];
          }
        }
        return null;
      } catch { return null; }
    }

    const [priceResults, earningsResults] = await Promise.all([
      Promise.all(tickers.map(t => fetchYahooPrice(t))),
      Promise.all(tickers.map(t => fetchEarningsDate(t))),
    ]);
    const livePrices: Record<string, number> = {};
    const earningsMap: Record<string, string> = {};
    tickers.forEach((t, i) => {
      livePrices[t] = priceResults[i];
      if (earningsResults[i]) earningsMap[t] = earningsResults[i] as string;
    });

    const horizonMarker = `"horizon":"${horizon}"`;
    // Clear existing picks for THIS horizon only
    await supabase.from('stock_news').delete().like('summary', `%${horizonMarker}%`);

    const shortlist = tickers.filter(t => earningsMap[t] && livePrices[t] > 0);
    if (shortlist.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, tickers: [], horizon, reason: `No tickers have confirmed earnings in ${horizonLabel.toLowerCase()}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceList = shortlist
      .map(t => `${t}: $${livePrices[t].toFixed(2)} | earnings ${earningsMap[t]}`)
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
            content: `You are an expert earnings momentum trader. Today is ${today}.

You receive a SHORTLIST of tickers with CONFIRMED earnings dates in the ${horizonLabel} window (verified via Yahoo Finance). Use the EXACT earnings_date from the shortlist — never invent dates.

Include ONLY tickers that meet ALL:
1. Strong expectation to BEAT analyst EPS (whisper numbers, guidance raises, tailwinds)
2. Strong next-quarter growth forecast
3. Risk:Reward >= 1:2

PRICE LEVELS — anchor to provided live prices:
- current_price = provided live price exactly.
- entry_price: 2-8% below current_price.
- price_target: 10-30% above current_price.
- stop_loss: below entry; (target-entry)/(entry-stop) >= 2.

Return 1-5 picks. Use ONLY tickers from the shortlist. Do not pad.`
          },
          {
            role: 'user',
            content: `Shortlist (live price | confirmed earnings date):\n${priceList}\n\nReturn best earnings momentum picks using the exact dates listed.`
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

    // Insert all picks — override current_price with live Yahoo price, earnings_date with verified date
    const validPicks = picks.filter((p: any) => earningsMap[String(p.ticker || '').toUpperCase()]);
    if (validPicks.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, tickers: [], horizon, reason: 'AI returned no tickers from verified shortlist' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const inserts = validPicks.map((pick: any, index: number) => {
      const sym = String(pick.ticker || '').toUpperCase();
      const live = livePrices[sym] || 0;
      const aiCurrent = Number(pick.current_price) || 0;
      let current = live > 0 ? live : aiCurrent;
      let entry = Number(pick.entry_price) || 0;
      let target = Number(pick.price_target) || 0;
      let stop = Number(pick.stop_loss) || 0;
      if (live > 0 && aiCurrent > 0 && Math.abs(live - aiCurrent) / aiCurrent > 0.02) {
        const r = live / aiCurrent;
        entry = +(entry * r).toFixed(2);
        target = +(target * r).toFixed(2);
        stop = +(stop * r).toFixed(2);
        current = live;
      }
      if (!(entry > 0 && entry <= current)) entry = +(current * 0.95).toFixed(2);
      if (!(target > current)) target = +(current * 1.15).toFixed(2);
      if (!(stop > 0 && stop < entry)) stop = +(entry * 0.93).toFixed(2);
      const rr = ((target - entry) / Math.max(0.01, entry - stop)).toFixed(2);
      return {
        ticker: sym,
        headline: pick.headline,
        summary: JSON.stringify({
          rank: index + 1,
          earnings_date: earningsMap[sym], // verified
          consensus_eps: pick.consensus_eps,
          expected_eps: pick.expected_eps,
          beat_confidence: pick.beat_confidence,
          current_price: current,
          entry_price: entry,
          price_target: target,
          stop_loss: stop,
          risk_reward_ratio: `1:${rr}`,
          horizon,
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

    return new Response(JSON.stringify({ success: true, count: picks.length, horizon, tickers: picks.map((p: any) => p.ticker) }), {
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
