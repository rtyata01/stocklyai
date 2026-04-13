import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { allTickers, StockQuote } from "@/data/stocks";

export function useStockData() {
  return useQuery({
    queryKey: ["stock-quotes"],
    queryFn: async (): Promise<StockQuote[]> => {
      const { data, error } = await supabase.functions.invoke("fetch-stocks", {
        body: { tickers: allTickers },
      });
      if (error) throw error;
      return data.quotes;
    },
    refetchInterval: 15 * 60 * 1000, // 15 min
    staleTime: 5 * 60 * 1000,
  });
}
