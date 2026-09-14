import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PortfolioTable from "@/components/PortfolioTable";
import { SectorGroup } from "@/data/stocks";

const SECTORS = [
  { value: "all", label: "All Sectors" },
  { value: "tech", label: "Tech" },
  { value: "ai", label: "AI" },
  { value: "robotics", label: "Robotics" },
  { value: "semis", label: "Semiconductors" },
  { value: "energy", label: "Energy" },
  { value: "nuclear", label: "Nuclear Energy" },
  { value: "fintech", label: "Fintech & Crypto" },
  { value: "biotech", label: "Biotech" },
  { value: "ev", label: "EV & Air Mobility" },
  { value: "quantum", label: "Quantum Computing" },
];

const CRITERIA = [
  { value: "highest_volume", label: "Highest Volume" },
  { value: "top_gainers", label: "Top Gainers" },
  { value: "trending", label: "Trending Stocks" },
  { value: "highest_dividends", label: "Highest Dividends" },
  { value: "highest_eps", label: "Highest EPS" },
  { value: "highest_pe", label: "Highest PE" },
];


export default function MarketWatchlistPanel() {
  const [sector, setSector] = useState<string>("ai");
  const [criterion, setCriterion] = useState<string>("highest_volume");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SectorGroup | null>(null);

  const run = useCallback(async () => {
    if (!sector || !criterion) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-screener", {
        body: { sector, criterion },
      });
      if (error) throw error;
      const tickers: string[] = (data?.rows ?? []).map((r: { ticker: string }) => r.ticker);
      if (!tickers.length) {
        toast.error("No stocks found for this selection");
        setResult(null);
        return;
      }
      const sectorLabel = SECTORS.find((s) => s.value === sector)?.label ?? sector;
      const criterionLabel = CRITERIA.find((c) => c.value === criterion)?.label ?? criterion;
      setResult({ name: `${sectorLabel} — ${criterionLabel}`, tickers });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load market stocks");
    } finally {
      setLoading(false);
    }
  }, [sector, criterion]);

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    didAutoRun.current = true;
    void run();
  }, [run]);

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="w-[200px] h-9 text-xs font-mono">
            <SelectValue placeholder="Select sector" />
          </SelectTrigger>
          <SelectContent>
            {SECTORS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs font-mono">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={criterion} onValueChange={setCriterion} disabled={!sector}>
          <SelectTrigger className="w-[200px] h-9 text-xs font-mono">
            <SelectValue placeholder="Select ranking" />
          </SelectTrigger>
          <SelectContent>
            {CRITERIA.map((c) => (
              <SelectItem key={c.value} value={c.value} className="text-xs font-mono">{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" className="gap-1.5 text-xs" onClick={run} disabled={!sector || !criterion || loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Find Best Stocks
        </Button>

      </div>

      {loading && (
        <div className="text-center text-muted-foreground py-16 font-mono text-sm">Scanning the market…</div>
      )}

      {!loading && !result && (
        <div className="text-center text-muted-foreground py-16 font-mono text-sm">
          Pick a sector and a ranking, then find the top 15 stocks.
        </div>
      )}

      {!loading && result && (
        <PortfolioTable
          key={result.name}
          sectors={[result]}
          viewFrom="mylists"
          showRefresh={false}
        />
      )}
    </div>
  );
}
