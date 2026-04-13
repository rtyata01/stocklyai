import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sectors } from "@/data/stocks";

export interface PriceEvaluation {
  ticker: string;
  buyPrice: number;
  holdPrice: number;
  salePrice: number;
}

const CACHE_KEY = "stock-price-evaluations";
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

export function usePriceEvaluations(quotes: { ticker: string; price: number }[] | undefined) {
  return useQuery({
    queryKey: ["price-evaluations"],
    queryFn: async (): Promise<PriceEvaluation[]> => {
      const cached = getCached();
      if (cached) return cached;

      if (!quotes || quotes.length === 0) return [];

      const sectorMap = new Map<string, string>();
      sectors.forEach(s => s.tickers.forEach(t => sectorMap.set(t, s.name)));

      const stocks = quotes
        .filter(q => q.price > 0)
        .map(q => ({
          ticker: q.ticker,
          price: q.price,
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
