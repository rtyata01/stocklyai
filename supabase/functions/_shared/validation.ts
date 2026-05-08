// Shared input validators for edge functions.
// Tickers must look like "AAPL", "BRK.B", "ETH", "QBTS-USD" — letters, digits, dot, dash.
const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;

export const MAX_TICKERS = 60;

export function isValidTicker(t: unknown): t is string {
  return typeof t === "string" && TICKER_RE.test(t);
}

export function sanitizeTickers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().toUpperCase();
    if (!isValidTicker(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= MAX_TICKERS) break;
  }
  return out;
}
