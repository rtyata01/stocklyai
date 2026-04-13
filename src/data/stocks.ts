export interface StockQuote {
  ticker: string;
  price: number;
  dayMin: number;
  dayMax: number;
  peRatio: number | null;
  change: number;
}

export interface SectorGroup {
  name: string;
  tickers: string[];
}

export const sectors: SectorGroup[] = [
  { name: "ETFs", tickers: ["SPY", "VOO"] },
  { name: "Big Tech", tickers: ["GOOGL", "MSFT", "AAPL", "AMZN", "META", "TSLA"] },
  { name: "Semiconductors", tickers: ["NVDA", "AMD", "MU", "SMCI"] },
  { name: "AI & Data", tickers: ["PLTR", "CRWV", "NBIS", "BBAI", "APLD"] },
  { name: "Fintech & Crypto", tickers: ["SOFI", "HOOD", "COIN", "MSTR"] },
  { name: "Quantum Computing", tickers: ["RGTI", "QBTS"] },
  { name: "eVTOL & Aviation", tickers: ["ACHR", "JOBY"] },
  { name: "Biotech & Genomics", tickers: ["RZLV", "NTLA", "CRSP"] },
  { name: "Crypto Assets", tickers: ["ETH", "SOL", "XRP", "BITF", "BMNR"] },
  { name: "Other", tickers: ["RR", "TLX"] },
];

export const allTickers = sectors.flatMap(s => s.tickers);

export function formatCurrency(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
