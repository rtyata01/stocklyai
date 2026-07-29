import { sanitizeTickers } from '../_shared/validation.ts';
import { writeAppCache } from '../_shared/cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRYPTO: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };

interface WeekStat { ticker: string; weekPct: number; monthPct: number; price: number }

async function fetchWeek(ticker: string): Promise<WeekStat | null> {
  try {
    const symbol = CRYPTO[ticker] || ticker;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const r = data?.chart?.result?.[0];
    const closes: number[] = (r?.indicators?.quote?.[0]?.close ?? []).filter(
      (c: unknown): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0,
    );
    if (closes.length < 2) return null;
    const last = closes[closes.length - 1];
    const weekAgo = closes[Math.max(0, closes.length - 6)];
    const monthAgo = closes[0];
    return {
      ticker,
      weekPct: Number(((last / weekAgo - 1) * 100).toFixed(2)),
      monthPct: Number(((last / monthAgo - 1) * 100).toFixed(2)),
      price: Number(last.toFixed(2)),
    };
  } catch {
    return null;
  }
}

async function fetchEvents(ticker: string) {
  try {
    const symbol = CRYPTO[ticker] || ticker;
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents,summaryDetail`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const r = data?.quoteSummary?.result?.[0];
    if (!r) return null;
    const raw = r.calendarEvents?.earnings?.earningsDate?.[0]?.raw;
    const div = r.calendarEvents?.dividendDate?.raw ?? r.summaryDetail?.exDividendDate?.raw;
    const yieldPct = r.summaryDetail?.dividendYield?.raw;
    const iso = (s?: number) => (s ? new Date(s * 1000).toISOString().slice(0, 10) : null);
    if (!raw && !div) return null;
    return {
      ticker,
      earningsDate: iso(raw),
      dividendDate: iso(div),
      dividendYield: typeof yieldPct === 'number' ? Number((yieldPct * 100).toFixed(2)) : null,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const body = await req.json().catch(() => ({}));
    const tickers = sanitizeTickers(body?.tickers);
    if (tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'valid tickers array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [stats, spy, events] = await Promise.all([
      Promise.all(tickers.map(fetchWeek)),
      fetchWeek('SPY'),
      Promise.all(tickers.slice(0, 25).map(fetchEvents)),
    ]);

    const holdings = stats.filter((s): s is WeekStat => !!s);
    if (holdings.length === 0) {
      return new Response(JSON.stringify({ error: 'no market data available' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Equal-weight ($1000 each) week performance + contribution share
    const startValue = holdings.length * 1000;
    const endValue = holdings.reduce((s, h) => s + 1000 * (1 + h.weekPct / 100), 0);
    const portfolioWeekPct = Number(((endValue / startValue - 1) * 100).toFixed(2));
    const spyWeekPct = spy?.weekPct ?? 0;

    const gainers = holdings.filter((h) => h.weekPct > 0);
    const losers = holdings.filter((h) => h.weekPct < 0);
    const totalGain = gainers.reduce((s, h) => s + 10 * h.weekPct, 0);
    const totalLoss = losers.reduce((s, h) => s + 10 * Math.abs(h.weekPct), 0);

    const drivers = [...holdings]
      .sort((a, b) => Math.abs(b.weekPct) - Math.abs(a.weekPct))
      .slice(0, 6)
      .map((h) => ({
        ticker: h.ticker,
        weekPct: h.weekPct,
        monthPct: h.monthPct,
        price: h.price,
        contributionPct:
          h.weekPct >= 0
            ? Number((totalGain > 0 ? ((10 * h.weekPct) / totalGain) * 100 : 0).toFixed(1))
            : Number((totalLoss > 0 ? ((10 * Math.abs(h.weekPct)) / totalLoss) * 100 : 0).toFixed(1)),
        direction: h.weekPct >= 0 ? 'gain' : 'loss',
      }));

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = events
      .filter((e): e is NonNullable<typeof e> => !!e)
      .filter((e) => (e.earningsDate && e.earningsDate >= today) || (e.dividendDate && e.dividendDate >= today))
      .sort((a, b) => (a.earningsDate ?? a.dividendDate ?? '9999').localeCompare(b.earningsDate ?? b.dividendDate ?? '9999'))
      .slice(0, 12);

    const facts = {
      portfolioWeekPct,
      spyWeekPct,
      alphaPct: Number((portfolioWeekPct - spyWeekPct).toFixed(2)),
      drivers,
      worst: [...holdings].sort((a, b) => a.weekPct - b.weekPct).slice(0, 4),
      best: [...holdings].sort((a, b) => b.weekPct - a.weekPct).slice(0, 4),
      upcoming,
      holdingsCount: holdings.length,
    };

    let narrative: {
      executiveSummary: string;
      drivers: string[];
      risks: string[];
      opportunities: string[];
    } = { executiveSummary: '', drivers: [], risks: [], opportunities: [] };

    if (LOVABLE_API_KEY) {
      try {
        const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content:
                  `Today is ${today}. You are a portfolio analyst writing a crisp weekly briefing. ` +
                  `Use ONLY the supplied numbers — never invent figures. Assume equal-weight $1000 per holding. ` +
                  `Be specific, name tickers, keep every line under 220 characters.`,
              },
              { role: 'user', content: `Portfolio facts (JSON):\n${JSON.stringify(facts)}` },
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'return_briefing',
                description: 'Return the weekly portfolio briefing',
                parameters: {
                  type: 'object',
                  properties: {
                    executiveSummary: { type: 'string', description: '2 sentences, e.g. "Your portfolio gained 2.4% this week, outperforming SPY by 0.8%."' },
                    drivers: { type: 'array', items: { type: 'string' }, description: '3-4 bullets naming tickers and their contribution share' },
                    risks: { type: 'array', items: { type: 'string' }, description: '3-4 concrete risk bullets (concentration, drawdown, volatile names, sector crowding)' },
                    opportunities: { type: 'array', items: { type: 'string' }, description: '3-4 bullets on opportunities plus upcoming earnings/dividend dates' },
                  },
                  required: ['executiveSummary', 'drivers', 'risks', 'opportunities'],
                },
              },
            }],
            tool_choice: { type: 'function', function: { name: 'return_briefing' } },
          }),
        });
        const ai = await resp.json();
        const call = ai?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (call) {
          narrative = JSON.parse(call);
        } else {
          const content = ai?.choices?.[0]?.message?.content ?? '';
          const m = content.match(/\{[\s\S]*\}/);
          if (m) narrative = JSON.parse(m[0]);
        }
      } catch (e) {
        console.warn('briefing AI failed:', (e as Error).message);
      }
    }

    if (!narrative.executiveSummary) {
      const verb = portfolioWeekPct >= 0 ? 'gained' : 'declined';
      const rel = facts.alphaPct >= 0 ? 'outperforming' : 'trailing';
      narrative.executiveSummary = `Your portfolio ${verb} ${Math.abs(portfolioWeekPct).toFixed(2)}% this week, ${rel} SPY by ${Math.abs(facts.alphaPct).toFixed(2)}%.`;
      narrative.drivers = drivers.map((d) => `${d.ticker} ${d.weekPct >= 0 ? '+' : ''}${d.weekPct}% this week (${d.contributionPct}% of the week's ${d.direction}s).`);
      narrative.risks = facts.worst.map((w) => `${w.ticker} is down ${Math.abs(w.weekPct).toFixed(2)}% this week and ${w.monthPct.toFixed(2)}% over the month — watch position size.`);
      narrative.opportunities = upcoming.map((u) =>
        `${u.ticker}: ${u.earningsDate ? `earnings ${u.earningsDate}` : ''}${u.earningsDate && u.dividendDate ? ' · ' : ''}${u.dividendDate ? `dividend ${u.dividendDate}` : ''}${u.dividendYield ? ` (${u.dividendYield}% yield)` : ''}`,
      );
    }

    const result = { generatedAt: new Date().toISOString(), ...facts, ...narrative };
    const cacheKey = `portfolio-briefing:${[...tickers].sort().join(',')}`;
    await writeAppCache(cacheKey, result, 6 * 60 * 60 * 1000);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('portfolio-briefing error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
