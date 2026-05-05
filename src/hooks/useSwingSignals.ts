import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWatchlistSectors } from "@/components/ManageWatchlistDialog";
import { loadFromCache, saveLocalCache, clearCache } from "@/lib/cacheClient";

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

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useSwingSignals(enabled: boolean) {
  const tickers = (() => {
    try {
      return getWatchlistSectors().flatMap((s) => s.tickers);
    } catch {
      return [];
    }
  })();
  const cacheKey = `swing-signals:${[...tickers].sort().join(",")}`;

  return useQuery({
    queryKey: ["swing-signals", cacheKey],
    enabled,
    queryFn: async (): Promise<SwingSignal[]> => {
      const cached = await loadFromCache<{ signals: SwingSignal[] } | SwingSignal[]>(
        cacheKey,
        CACHE_TTL,
      );
      if (cached) {
        const signals = Array.isArray(cached) ? cached : cached.signals;
        if (signals?.length) return signals;
      }
      const { data, error } = await supabase.functions.invoke("scrape-swing-signals", {
        body: { tickers },
      });
      if (error) throw error;
      const signals: SwingSignal[] = data?.signals ?? [];
      saveLocalCache(cacheKey, { signals }, CACHE_TTL);
      return signals;
    },
    staleTime: CACHE_TTL,
  });
}

export function clearSwingCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("swing-signals:"))
      .forEach((k) => clearCache(k));
  } catch {
    /* ignore */
  }
}
