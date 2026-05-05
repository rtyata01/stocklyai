import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { allTickers, StockQuote } from "@/data/stocks";
import { getWatchlistSectors } from "@/components/ManageWatchlistDialog";
import { loadFromCache, saveLocalCache } from "@/lib/cacheClient";

function getActiveTickers(): string[] {
  try {
    const tickers = getWatchlistSectors().flatMap((s) => s.tickers);
    const set = new Set<string>(tickers.length ? tickers : allTickers);
    return Array.from(set);
  } catch {
    return allTickers;
  }
}

const TTL = 15 * 60 * 1000;

export function useStockData() {
  const tickers = getActiveTickers();
  const cacheKey = `stock-quotes:${[...tickers].sort().join(",")}`;
  return useQuery({
    queryKey: ["stock-quotes", cacheKey],
    queryFn: async (): Promise<StockQuote[]> => {
      const cached = await loadFromCache<{ quotes: StockQuote[] } | StockQuote[]>(cacheKey, TTL);
      if (cached) {
        const quotes = Array.isArray(cached) ? cached : cached.quotes;
        if (quotes?.length) return quotes;
      }
      const { data, error } = await supabase.functions.invoke("fetch-stocks", {
        body: { tickers },
      });
      if (error) throw error;
      saveLocalCache(cacheKey, { quotes: data.quotes }, TTL);
      return data.quotes;
    },
    refetchInterval: 15 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}
