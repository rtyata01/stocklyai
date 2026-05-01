import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWatchlistSectors } from "@/components/ManageWatchlistDialog";

export interface SwingSignal {
  ticker: string;
  company_name: string;
  signal_type:
    | "FDA_APPROVAL"
    | "CONTRACT_WIN"
    | "ANALYST_UPGRADE"
    | "PRODUCT_LAUNCH"
    | "INSIDER_BUYING"
    | "SHORT_SQUEEZE"
    | "SECTOR_TAILWIND"
    | "TECHNICAL_BREAKOUT";
  headline: string;
  event_date: string;
  details: string;
  why_it_matters: string;
  current_price: number;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  holding_days: number;
  confidence: "High" | "Medium" | "Low";
  source_url?: string;
}

const CACHE_KEY = "swing-signals-cache-v1";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useSwingSignals(enabled: boolean) {
  return useQuery({
    queryKey: ["swing-signals"],
    enabled,
    queryFn: async (): Promise<SwingSignal[]> => {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { ts, data } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) return data;
        } catch {}
      }
      const tickers = getWatchlistSectors().flatMap((s) => s.tickers);
      const { data, error } = await supabase.functions.invoke("scrape-swing-signals", {
        body: { tickers },
      });
      if (error) throw error;
      const signals = data?.signals ?? [];
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: signals }));
      return signals;
    },
    staleTime: CACHE_TTL,
  });
}

export function clearSwingCache() {
  localStorage.removeItem(CACHE_KEY);
}
