import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectors } from "@/data/stocks";
import { loadFromCache, saveLocalCache, clearCache } from "@/lib/cacheClient";

export interface PriceEvaluation {
  ticker: string;
  buyPrice: number;
  holdPrice: number;
  salePrice: number;
  reasoning?: string;
}

const CACHE_TTL = 24 * 60 * 60 * 1000;

const keyFor = (tickers: string[]) =>
  `price-evaluations:${[...tickers].sort().join(",")}`;

export function clearPriceCache() {
  // best-effort: clear all known evaluation keys for current page
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("price-evaluations:"))
      .forEach((k) => clearCache(k));
  } catch {
    /* ignore */
  }
}

export function usePriceEvaluations(
  quotes:
    | { ticker: string; price: number; dayMin: number; dayMax: number; change: number }[]
    | undefined,
  refreshNonce = 0,
) {
  const tickers = (quotes ?? []).map((q) => q.ticker);
  const cacheKey = keyFor(tickers);

  return useQuery({
    queryKey: ["price-evaluations", cacheKey, refreshNonce],
    queryFn: async (): Promise<PriceEvaluation[]> => {
      if (!quotes || quotes.length === 0) return [];

      if (refreshNonce === 0) {
        const cached = await loadFromCache<{ evaluations: PriceEvaluation[] } | PriceEvaluation[]>(
          cacheKey,
          CACHE_TTL,
        );
        if (cached) {
          const evals = Array.isArray(cached) ? cached : cached.evaluations;
          if (evals && quotes.every((q) => evals.some((c) => c.ticker === q.ticker))) {
            return evals;
          }
        }
      }

      const sectorMap = new Map<string, string>();
      sectors.forEach((s) => s.tickers.forEach((t) => sectorMap.set(t, s.name)));

      const stocks = quotes
        .filter((q) => q.price > 0)
        .map((q) => ({
          ticker: q.ticker,
          price: q.price,
          dayMin: q.dayMin,
          dayMax: q.dayMax,
          change: q.change,
          sector: sectorMap.get(q.ticker) || "Other",
        }));

      const { data, error } = await supabase.functions.invoke("evaluate-prices", {
        body: { stocks, force: refreshNonce > 0 },
      });
      if (error || !data?.evaluations) {
        // Rate limited or transient failure: serve cached evaluations rather than erroring the page.
        const fallback = await loadFromCache<{ evaluations: PriceEvaluation[] } | PriceEvaluation[]>(cacheKey, Number.MAX_SAFE_INTEGER);
        const list = Array.isArray(fallback) ? fallback : fallback?.evaluations;
        return list ?? [];
      }
      const evaluations: PriceEvaluation[] = data.evaluations;
      saveLocalCache(cacheKey, { evaluations }, CACHE_TTL);
      return evaluations;
    },
    enabled: !!quotes && quotes.length > 0,
    staleTime: CACHE_TTL,
    retry: 1,
  });
}
