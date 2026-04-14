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

    // Delete news older than 7 days
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

    // Use AI to generate recent news summaries
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
            content: `You are a financial news analyst. Generate the most important and recent stock market news from the past week for the given tickers. Focus on:
1. Earnings reports and guidance
2. FDA approvals or rejections (mark these explicitly)
3. Major partnerships, acquisitions, or contracts
4. Analyst upgrades/downgrades
5. Significant price movements and catalysts
6. Regulatory developments

For each news item, provide the ticker, headline, a brief summary, and whether it's FDA-related.
Only include real, plausible news items that would be relevant this week (April 2026).
Provide 2-4 news items per sector, focusing on the most impactful stories.`
          },
          {
            role: 'user',
            content: `Generate recent weekly news for these tickers: ${tickers.join(', ')}. Today's date is ${new Date().toISOString().split('T')[0]}.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_news',
              description: 'Return stock news items',
              parameters: {
                type: 'object',
                properties: {
                  news: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        ticker: { type: 'string' },
                        headline: { type: 'string' },
                        summary: { type: 'string' },
                        is_fda_related: { type: 'boolean' },
                        days_ago: { type: 'number', description: 'How many days ago, 0-6' },
                      },
                      required: ['ticker', 'headline', 'summary', 'is_fda_related', 'days_ago'],
                    },
                  },
                },
                required: ['news'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_news' } },
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
    const newsItems = parsed.news;

    // Insert news items
    const rows = newsItems.map((item: any) => ({
      ticker: item.ticker,
      headline: item.headline,
      summary: item.summary,
      is_fda_related: item.is_fda_related,
      published_at: new Date(Date.now() - item.days_ago * 24 * 60 * 60 * 1000).toISOString(),
    }));

    // Clear existing news before inserting fresh batch
    await supabase.from('stock_news').delete().gte('created_at', sevenDaysAgo);
    
    const { error: insertError } = await supabase.from('stock_news').insert(rows);
    if (insertError) {
      console.error('Insert error:', insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
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
