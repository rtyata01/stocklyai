// Shared Yahoo Finance helpers used to ground AI peer/alternative selection in
// real company context instead of the model's fuzzy memory.

const CRYPTO_MAP: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };
const UA = { 'User-Agent': 'Mozilla/5.0' };

export function yahooSymbol(ticker: string): string {
  return CRYPTO_MAP[ticker] || ticker;
}

export interface CompanyProfile {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  summary: string;
  marketCap: number;
  price: number;
}

export async function fetchYahooPrice(ticker: string): Promise<number> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(ticker))}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: UA });
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' && price > 0 ? price : 0;
  } catch {
    return 0;
  }
}

/** Company description, sector/industry and market cap — the context the model needs. */
export async function fetchCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
  const symbol = yahooSymbol(ticker);
  const modules = 'assetProfile,price,summaryDetail,defaultKeyStatistics';
  for (const host of ['query2', 'query1']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
      const res = await fetch(url, { headers: UA });
      if (!res.ok) continue;
      const r = (await res.json())?.quoteSummary?.result?.[0];
      if (!r) continue;
      const profile = r.assetProfile || {};
      const price = r.price || {};
      return {
        ticker,
        name: price.longName || price.shortName || ticker,
        sector: profile.sector || '',
        industry: profile.industry || '',
        summary: String(profile.longBusinessSummary || '').slice(0, 1200),
        marketCap: Number(price.marketCap?.raw || r.summaryDetail?.marketCap?.raw || 0),
        price: Number(price.regularMarketPrice?.raw || 0),
      };
    } catch {
      /* try next host */
    }
  }
  return null;
}

/** Yahoo's own "people also watch" list — strong real-world signal for peers. */
export async function fetchYahooRelated(ticker: string): Promise<string[]> {
  const symbol = yahooSymbol(ticker);
  const out = new Set<string>();
  for (const url of [
    `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(symbol)}`,
    `https://query1.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(symbol)}`,
  ]) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) continue;
      const rows = (await res.json())?.finance?.result?.[0]?.recommendedSymbols || [];
      for (const row of rows) {
        const s = String(row?.symbol || '').toUpperCase();
        if (s && s !== symbol) out.add(s);
      }
      if (out.size) break;
    } catch {
      /* ignore */
    }
  }
  return Array.from(out).slice(0, 10);
}

/** Keep only tickers that actually trade today. */
export async function filterTradableTickers(tickers: string[]): Promise<Set<string>> {
  const prices = await Promise.all(tickers.map((t) => fetchYahooPrice(t)));
  const ok = new Set<string>();
  tickers.forEach((t, i) => { if (prices[i] > 0) ok.add(t); });
  return ok;
}

export function profileBlock(p: CompanyProfile | null, ticker: string, related: string[]): string {
  const lines: string[] = [];
  if (p) {
    lines.push(`Ticker: ${p.ticker} (${p.name})`);
    if (p.sector || p.industry) lines.push(`Sector / industry: ${p.sector || 'n/a'} / ${p.industry || 'n/a'}`);
    if (p.marketCap > 0) lines.push(`Market cap: $${(p.marketCap / 1e9).toFixed(2)}B`);
    if (p.price > 0) lines.push(`Current price: $${p.price.toFixed(2)}`);
    if (p.summary) lines.push(`Business description: ${p.summary}`);
  } else {
    lines.push(`Ticker: ${ticker}`);
  }
  if (related.length) {
    lines.push(`Tickers investors most often view alongside ${ticker} (Yahoo Finance "people also watch"): ${related.join(', ')}. Treat these as strong candidates, but only include the ones that truly match the business model.`);
  }
  return lines.join('\n');
}
