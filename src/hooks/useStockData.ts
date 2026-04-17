import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { allTickers, StockQuote } from "@/data/stocks";
import { getWatchlistSectors } from "@/components/ManageWatchlistDialog";

function getActiveTickers(): string[] {
  try {
    const tickers = getWatchlistSectors().flatMap(s => s.tickers);
    // De-duplicate and merge with defaults so nothing disappears if watchlist is empty
    const set = new Set<string>(tickers.length ? tickers : allTickers);
    return Array.from(set);
  } catch {
    return allTickers;
  }
}

export function useStockData() {
  const tickers = getActiveTickers();
  return useQuery({
    queryKey: ["stock-quotes", tickers.sort().join(",")],
    queryFn: async (): Promise<StockQuote[]> => {
      const { data, error } = await supabase.functions.invoke("fetch-stocks", {
        body: { tickers },
      });
      if (error) throw error;
      return data.quotes;
    },
    refetchInterval: 15 * 60 * 1000, // 15 min
    staleTime: 5 * 60 * 1000,
  });
}
