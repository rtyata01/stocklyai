import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectors } from "@/data/stocks";
import { loadFromCache, saveLocalCache } from "@/lib/cacheClient";

export interface StockInsight {
  ticker: string;
  isKing: boolean;
  dominanceReason: string;
  bullPrice: number;
  bearPrice: number;
  riskPct: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000;

export function useStockInsights(
  quotes: { ticker: string; price: number }[] | undefined,
  refreshNonce = 0,
) {
  const tickers = (quotes ?? []).map(q => q.ticker);
  const cacheKey = `stock-insights:${[...tickers].sort().join(",")}`;

  return useQuery({
    queryKey: ["stock-insights", cacheKey, refreshNonce],
    queryFn: async (): Promise<StockInsight[]> => {
      if (!quotes || quotes.length === 0) return [];
      if (refreshNonce === 0) {
        const cached = await loadFromCache<{ insights: StockInsight[] } | StockInsight[]>(cacheKey, CACHE_TTL);
        if (cached) {
          const list = Array.isArray(cached) ? cached : cached.insights;
          if (list && quotes.every(q => list.some(c => c.ticker === q.ticker))) return list;
        }
      }
      const sectorMap = new Map<string, string>();
      sectors.forEach(s => s.tickers.forEach(t => sectorMap.set(t, s.name)));
      const stocks = quotes.filter(q => q.price > 0).map(q => ({
        ticker: q.ticker,
        price: q.price,
        sector: sectorMap.get(q.ticker) || "Other",
      }));
      const { data, error } = await supabase.functions.invoke("stock-insights", { body: { stocks } });
      if (error) throw error;
      const insights: StockInsight[] = data.insights;
      saveLocalCache(cacheKey, { insights }, CACHE_TTL);
      return insights;
    },
    enabled: !!quotes && quotes.length > 0,
    staleTime: CACHE_TTL,
    retry: 1,
  });
}
