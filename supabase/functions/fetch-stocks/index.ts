const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALPHA_VANTAGE_KEY = Deno.env.get('ALPHA_VANTAGE_API_KEY') || '';

interface StockQuote {
  ticker: string;
  price: number;
  dayMin: number;
  dayMax: number;
  peRatio: number | null;
  change: number;
}

// Cache to avoid rate limits
const cache = new Map<string, { data: StockQuote; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function fetchAlphaVantage(ticker: string): Promise<StockQuote | null> {
  try {
    // For crypto tickers, use CURRENCY_EXCHANGE_RATE
    const cryptoTickers: Record<string, string> = {
      'ETH': 'ETH', 'SOL': 'SOL', 'XRP': 'XRP'
    };

    if (cryptoTickers[ticker]) {
      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${ticker}&to_currency=USD&apikey=${ALPHA_VANTAGE_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const rate = data?.['Realtime Currency Exchange Rate'];
      if (!rate) return null;
      const price = parseFloat(rate['5. Exchange Rate']);
      return {
        ticker,
        price,
        dayMin: price * 0.97,
        dayMax: price * 1.03,
        peRatio: null,
        change: parseFloat(rate['9. Change Percent']?.replace('%', '') || '0'),
      };
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const quote = data?.['Global Quote'];
    if (!quote || !quote['05. price']) return null;

    return {
      ticker,
      price: parseFloat(quote['05. price']),
      dayMin: parseFloat(quote['04. low']),
      dayMax: parseFloat(quote['03. high']),
      peRatio: null, // AV Global Quote doesn't include PE
      change: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
    };
  } catch {
    return null;
  }
}

async function fetchYahoo(ticker: string): Promise<StockQuote | null> {
  try {
    // Map crypto tickers for Yahoo
    const yahooTicker: Record<string, string> = {
      'ETH': 'ETH-USD', 'SOL': 'SOL-USD', 'XRP': 'XRP-USD'
    };
    const symbol = yahooTicker[ticker] || ticker;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose;
    const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

    return {
      ticker,
      price,
      dayMin: meta.regularMarketDayLow ?? price * 0.97,
      dayMax: meta.regularMarketDayHigh ?? price * 1.03,
      peRatio: null, // Will try to get from summary
      change: changePercent,
    };
  } catch {
    return null;
  }
}

async function fetchQuote(ticker: string): Promise<StockQuote> {
  const cached = cache.get(ticker);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  let quote = await fetchAlphaVantage(ticker);
  if (!quote) {
    quote = await fetchYahoo(ticker);
  }
  if (!quote) {
    quote = { ticker, price: 0, dayMin: 0, dayMax: 0, peRatio: null, change: 0 };
  }

  cache.set(ticker, { data: quote, ts: Date.now() });
  return quote;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'tickers array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch in batches of 5 to respect rate limits
    const results: StockQuote[] = [];
    for (let i = 0; i < tickers.length; i += 5) {
      const batch = tickers.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(fetchQuote));
      results.push(...batchResults);
      if (i + 5 < tickers.length) {
        await new Promise(r => setTimeout(r, 1200)); // Rate limit pause
      }
    }

    return new Response(JSON.stringify({ quotes: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
