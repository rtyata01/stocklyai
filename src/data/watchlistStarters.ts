import { DEFAULT_LEADERS } from "@/data/marketLeaders";
import { sectors } from "@/data/stocks";

const sectorTickers = (names: string[]) => sectors.filter((sector) => names.includes(sector.name)).flatMap((sector) => sector.tickers);

export const watchlistStarters = [
  { id: "buffett", label: "Copy Buffett's holdings", name: "Buffett's Holdings", tickers: [...(DEFAULT_LEADERS.find((leader) => leader.id === "buffett")?.tickers ?? [])] },
  { id: "ai", label: "Copy AI sector leaders", name: "AI Sector Leaders", tickers: sectorTickers(["Semiconductors", "AI & Data"]) },
  { id: "moats", label: "Copy Market Moats", name: "Market Moats", tickers: sectorTickers(["Big Tech", "Semiconductors"]).filter((ticker) => ["GOOGL", "AAPL", "NVDA", "MSFT"].includes(ticker)) },
  { id: "blank", label: "Start blank", name: "My Watchlist", tickers: [] },
];

export type WatchlistStarter = typeof watchlistStarters[number];

export function uniqueStarterName(name: string, existingNames: string[]): string {
  const names = new Set(existingNames.map((value) => value.toLowerCase()));
  let candidate = name;
  let suffix = 2;
  while (names.has(candidate.toLowerCase())) candidate = `${name} (${suffix++})`;
  return candidate;
}