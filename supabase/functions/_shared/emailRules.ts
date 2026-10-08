import { z } from 'npm:zod@3.25.76';

export const tickerSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9.^=-]{0,14}$/);
export const emailSchema = z.string().trim().toLowerCase().email().max(255);
export const tokenSchema = z.string().uuid();
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
export async function marketPrice(ticker: string): Promise<number | null> {
  const aliases: Record<string, string> = { ETH: 'ETH-USD', SOL: 'SOL-USD', XRP: 'XRP-USD' };
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(aliases[ticker] ?? ticker)}?interval=1m&range=1d`, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
  } catch { return null; }
}