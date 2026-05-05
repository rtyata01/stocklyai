import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadFromCache, saveLocalCache } from "@/lib/cacheClient";

export interface QuarterlyEarning {
  quarter: string;
  eps: number;
  revenue: number;
  isEstimate: boolean;
}

export interface YearlyEarning {
  year: string;
  eps: number;
  revenue: number;
  isEstimate: boolean;
}

export interface PricePoint {
  period: string;
  price: number;
}

export interface Catalyst {
  event: string;
  date: string | null;
  impact: "bullish" | "bearish" | "neutral";
  details: string;
}

export interface PeriodReturn {
  period: string; // "1W" | "1M" | "3M" | "6M" | "1Y" | "4Y"
  label: string; // human label
  startPrice: number;
  endValue: number; // value of $1000 invested at startPrice, now
  returnPct: number; // percentage return
}

export interface InvestmentSimulation {
  initialInvestment: number;
  periodReturns: PeriodReturn[];
}

export interface StockDetail {
  currentPrice: number;
  week52High: number;
  week52Low: number;
  peRatio: number | null;
  eps: number | null;
  freeCashFlow: number | null;
  totalRevenue: number | null;
  marketCap: number | null;
  quarterlyEarnings: QuarterlyEarning[];
  yearlyEarnings: YearlyEarning[];
  priceHistory: PricePoint[];
  investmentSimulation: InvestmentSimulation;
  catalysts: Catalyst[];
}

const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

export function useStockDetail(ticker: string | undefined) {
  return useQuery({
    queryKey: ["stock-detail", ticker],
    queryFn: async (): Promise<StockDetail> => {
      if (!ticker) throw new Error("No ticker");
      const key = `stock-detail:${ticker}`;
      const cached = await loadFromCache<{ detail: StockDetail } | StockDetail>(key, CACHE_TTL);
      if (cached) {
        const detail = (cached as { detail?: StockDetail }).detail ?? (cached as StockDetail);
        if (detail) return detail;
      }
      const { data, error } = await supabase.functions.invoke("fetch-stock-detail", {
        body: { ticker },
      });
      if (error) throw error;
      const detail: StockDetail = data.detail;
      saveLocalCache(key, { detail }, CACHE_TTL);
      return detail;
    },
    enabled: !!ticker,
    staleTime: 4 * 60 * 60 * 1000,
    retry: 1,
  });
}
