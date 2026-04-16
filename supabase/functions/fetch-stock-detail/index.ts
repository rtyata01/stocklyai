const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticker } = await req.json();
    if (!ticker) {
      return new Response(JSON.stringify({ error: 'ticker required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Use AI to get comprehensive stock data
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
            content: `You are a financial data provider. Return comprehensive stock data for the requested ticker. Use the most recent publicly available data. For estimated future quarters/years, use analyst consensus estimates. All values in USD. For crypto assets, adapt the fields appropriately (no PE/EPS, use market cap instead).`
          },
          {
            role: 'user',
            content: `Provide detailed financial data for ${ticker} as of April 2026. Include:
- Current price, 52-week high/low
- PE ratio, EPS (TTM)
- Free cash flow (annual)
- Total revenue (annual)
- Market cap
- Past 4 quarters earnings (actual EPS and revenue)
- Next 4 quarters earnings estimates
- Past 4 years annual earnings (EPS and revenue) 
- Next 4 years annual earnings estimates
- Quarterly price history (past 8 quarters close price)
- Investment returns: For $1,000 invested at the start of each of these periods (1 week ago, 1 month ago, 3 months ago, 6 months ago, 1 year ago, 4 years ago), compute the start-of-period price, the current value of the $1,000 investment now, and the percentage return using actual historical close prices.
- Upcoming major catalysts (earnings dates, product launches, FDA decisions, regulatory events, analyst days, M&A activity, key partnerships, macro events) with specific dates where known. Include 3-8 catalysts.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_stock_detail',
              description: 'Return detailed stock information',
              parameters: {
                type: 'object',
                properties: {
                  currentPrice: { type: 'number' },
                  week52High: { type: 'number' },
                  week52Low: { type: 'number' },
                  peRatio: { type: 'number', description: 'null for crypto' },
                  eps: { type: 'number', description: 'TTM EPS, null for crypto' },
                  freeCashFlow: { type: 'number', description: 'Annual FCF in millions' },
                  totalRevenue: { type: 'number', description: 'Annual revenue in millions' },
                  marketCap: { type: 'number', description: 'Market cap in billions' },
                  quarterlyEarnings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        quarter: { type: 'string', description: 'e.g. Q1 2025' },
                        eps: { type: 'number' },
                        revenue: { type: 'number', description: 'in millions' },
                        isEstimate: { type: 'boolean' },
                      },
                      required: ['quarter', 'eps', 'revenue', 'isEstimate'],
                    },
                  },
                  yearlyEarnings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        year: { type: 'string' },
                        eps: { type: 'number' },
                        revenue: { type: 'number', description: 'in millions' },
                        isEstimate: { type: 'boolean' },
                      },
                      required: ['year', 'eps', 'revenue', 'isEstimate'],
                    },
                  },
                  priceHistory: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        period: { type: 'string' },
                        price: { type: 'number' },
                      },
                      required: ['period', 'price'],
                    },
                  },
                  investmentSimulation: {
                    type: 'object',
                    properties: {
                      initialInvestment: { type: 'number' },
                      currentValue: { type: 'number' },
                      totalReturn: { type: 'number', description: 'percentage' },
                      dataPoints: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            date: { type: 'string' },
                            value: { type: 'number' },
                          },
                          required: ['date', 'value'],
                        },
                      },
                    },
                    required: ['initialInvestment', 'currentValue', 'totalReturn', 'dataPoints'],
                  },
                  catalysts: {
                    type: 'array',
                    description: 'Upcoming major catalysts for this stock',
                    items: {
                      type: 'object',
                      properties: {
                        event: { type: 'string', description: 'Name of the catalyst event' },
                        date: { type: 'string', description: 'Expected date (YYYY-MM-DD) or null if unknown' },
                        impact: { type: 'string', enum: ['bullish', 'bearish', 'neutral'], description: 'Expected impact direction' },
                        details: { type: 'string', description: 'Brief explanation of why this matters' },
                      },
                      required: ['event', 'impact', 'details'],
                    },
                  },
                },
                required: ['currentPrice', 'week52High', 'week52Low', 'quarterlyEarnings', 'yearlyEarnings', 'priceHistory', 'investmentSimulation', 'catalysts'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_stock_detail' } },
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

    const detail = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ detail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('fetch-stock-detail error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
