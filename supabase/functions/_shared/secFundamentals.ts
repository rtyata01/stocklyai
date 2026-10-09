import { readAppCacheStale, writeAppCache } from './cache.ts';
import { extractReportedFundamentals } from './reportedFundamentals.ts';
const headers = { 'User-Agent': 'StocklyAI contact tyataessence@gmail.com', Accept: 'application/json' };
export async function secFundamentals(ticker: string, price: number) {
  try {
    let directory = await readAppCacheStale('sec-company-directory');
    if (!directory || Date.now() - (directory.fetchedAt ?? 0) > 7 * 86400000) {
      const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers, signal: AbortSignal.timeout(12000) });
      if (!res.ok) return null;
      directory = { entries: await res.json(), fetchedAt: Date.now() };
      await writeAppCache('sec-company-directory', directory, 7 * 86400000);
    }
    const company = Object.values(directory.entries ?? {}).find((v: any) => v.ticker === ticker) as any;
    if (!company) return null;
    const cik = String(company.cik_str).padStart(10, '0');
    const key = `sec-facts:${cik}`;
    let cached = await readAppCacheStale(key);
    if (!cached || Date.now() - (cached.fetchedAt ?? 0) > 86400000) {
      const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return null;
      cached = { data: await res.json(), fetchedAt: Date.now() };
      await writeAppCache(key, cached, 86400000);
    }
    return extractReportedFundamentals(cached.data, price);
  } catch { return null; }
}