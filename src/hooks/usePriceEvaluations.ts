import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectors } from "@/data/stocks";

export interface PriceEvaluation {
  ticker: string;
  buyPrice: number;
  holdPrice: number;
  salePrice: number;
  reasoning?: string;
}

const CACHE_KEY = "stock-price-evaluations-v2";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData {
  evaluations: PriceEvaluation[];
  ts: number;
}

function getCached(): PriceEvaluation[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedData = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.evaluations;
  } catch {
    return null;
  }
}

function setCache(evaluations: PriceEvaluation[]) {
  const data: CachedData = { evaluations, ts: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
}

export function clearPriceCache() {
  localStorage.removeItem(CACHE_KEY);
}

export function usePriceEvaluations(quotes: { ticker: string; price: number; dayMin: number; dayMax: number; change: number }[] | undefined) {
  const tickerKey = (quotes ?? []).map(q => q.ticker).sort().join(",");
  return useQuery({
    queryKey: ["price-evaluations", tickerKey],
    queryFn: async (): Promise<PriceEvaluation[]> => {
      const cached = getCached();
      // Only use cache if it covers every requested ticker
      if (cached && quotes && quotes.every(q => cached.some(c => c.ticker === q.ticker))) {
        return cached;
      }

      if (!quotes || quotes.length === 0) return [];

      const sectorMap = new Map<string, string>();
      sectors.forEach(s => s.tickers.forEach(t => sectorMap.set(t, s.name)));

      const stocks = quotes
        .filter(q => q.price > 0)
        .map(q => ({
          ticker: q.ticker,
          price: q.price,
          dayMin: q.dayMin,
          dayMax: q.dayMax,
          change: q.change,
          sector: sectorMap.get(q.ticker) || "Other",
        }));

      const { data, error } = await supabase.functions.invoke("evaluate-prices", {
        body: { stocks },
      });

      if (error) throw error;
      const evaluations: PriceEvaluation[] = data.evaluations;
      setCache(evaluations);
      return evaluations;
    },
    enabled: !!quotes && quotes.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
