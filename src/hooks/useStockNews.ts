import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StockNewsItem {
  id: string;
  ticker: string;
  headline: string;
  summary: string | null;
  source_url: string | null;
  published_at: string;
  is_fda_related: boolean;
  created_at: string;
}

export function useStockNews() {
  return useQuery({
    queryKey: ["stock-news"],
    queryFn: async (): Promise<StockNewsItem[]> => {
      const { data, error } = await supabase
        .from("stock_news")
        .select("*")
        .order("published_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as StockNewsItem[];
    },
    refetchInterval: 30 * 60 * 1000,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRefreshNews() {
  const refresh = async () => {
    // Run both horizons in parallel so we get short (2-3 weeks) AND mid (1-2 months) picks.
    const [shortRes, midRes] = await Promise.all([
      supabase.functions.invoke("scrape-news", { body: { horizon: "short" } }),
      supabase.functions.invoke("scrape-news", { body: { horizon: "mid" } }),
    ]);
    if (shortRes.error && midRes.error) throw shortRes.error;
  };
  return refresh;
}
