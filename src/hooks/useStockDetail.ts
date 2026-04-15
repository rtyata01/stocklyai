import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export interface InvestmentSimulation {
  initialInvestment: number;
  currentValue: number;
  totalReturn: number;
  dataPoints: { date: string; value: number }[];
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

const CACHE_KEY = "stock-detail-cache";
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function getCached(ticker: string): StockDetail | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}-${ticker}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(`${CACHE_KEY}-${ticker}`);
      return null;
    }
    return parsed.detail;
  } catch {
    return null;
  }
}

function setCache(ticker: string, detail: StockDetail) {
  localStorage.setItem(`${CACHE_KEY}-${ticker}`, JSON.stringify({ detail, ts: Date.now() }));
}

export function useStockDetail(ticker: string | undefined) {
  return useQuery({
    queryKey: ["stock-detail", ticker],
    queryFn: async (): Promise<StockDetail> => {
      if (!ticker) throw new Error("No ticker");

      const cached = getCached(ticker);
      if (cached) return cached;

      const { data, error } = await supabase.functions.invoke("fetch-stock-detail", {
        body: { ticker },
      });
      if (error) throw error;
      const detail: StockDetail = data.detail;
      setCache(ticker, detail);
      return detail;
    },
    enabled: !!ticker,
    staleTime: 4 * 60 * 60 * 1000,
    retry: 1,
  });
}
