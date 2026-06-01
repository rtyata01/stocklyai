import { useMemo, useState } from "react";
import { useStockData } from "@/hooks/useStockData";
import { supabase } from "@/integrations/supabase/client";
import { loadFromCache, saveLocalCache } from "@/lib/cacheClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2 } from "lucide-react";
import { formatCurrency } from "@/data/stocks";

interface ComparisonRow {
  ticker: string;
  growth: string;
  margins: string;
  tam: string;
  valuation: string;
  aiPositioning: string;
  moat: string;
  bullPrice: number;
  bearPrice: number;
  riskPct: number;
}

interface ComparisonResult {
  comparisons: ComparisonRow[];
  verdict: string;
}

const CACHE_TTL = 12 * 60 * 60 * 1000;

const ROWS: { key: keyof ComparisonRow; label: string }[] = [
  { key: "growth", label: "Growth" },
  { key: "margins", label: "Margins" },
  { key: "tam", label: "TAM" },
  { key: "valuation", label: "Valuation" },
  { key: "aiPositioning", label: "AI Positioning" },
  { key: "moat", label: "Moat" },
];

export default function StockComparisonPanel() {
  const { data: quotes } = useStockData();
  const universe = useMemo(
    () => (quotes ?? []).map(q => q.ticker).sort(),
    [quotes]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (t: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else if (next.size < 8) next.add(t);
      return next;
    });
  };

  const runCompare = async () => {
    if (selected.size < 2) return;
    setLoading(true);
    setError(null);
    const tickers = Array.from(selected).sort();
    const key = `stock-comparison:${tickers.join(",")}`;
    try {
      const cached = await loadFromCache<ComparisonResult>(key, CACHE_TTL);
      if (cached) {
        setResult(cached);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("compare-stocks", { body: { tickers } });
      if (error) throw error;
      saveLocalCache(key, data, CACHE_TTL);
      setResult(data as ComparisonResult);
    } catch (e: any) {
      setError(e?.message || "Failed to compare");
    } finally {
      setLoading(false);
    }
  };

  const priceFor = (t: string) => quotes?.find(q => q.ticker === t)?.price ?? 0;
  const pct = (target: number, current: number) =>
    current > 0 ? ((target - current) / current) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-sm p-4 bg-secondary/20">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="font-serif text-base text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Stock Comparison
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Pick 2–8 stocks from your watchlist for a head-to-head AI breakdown across growth, margins, TAM, valuation, AI positioning, moat, and risk.
            </p>
          </div>
          <Button onClick={runCompare} disabled={selected.size < 2 || loading} size="sm" className="gap-1.5 text-xs shrink-0">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Compare ({selected.size})
          </Button>
        </div>

        <ScrollArea className="h-32 border border-border rounded-sm bg-background p-2">
          <div className="flex flex-wrap gap-1.5">
            {universe.length === 0 && (
              <span className="text-xs text-muted-foreground font-mono">Loading tickers…</span>
            )}
            {universe.map(t => {
              const checked = selected.has(t);
              return (
                <label
                  key={t}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border cursor-pointer text-xs font-mono transition-colors ${
                    checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-foreground hover:bg-secondary"
                  }`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(t)} className="h-3 w-3" />
                  {t}
                </label>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {error && (
        <div className="text-center text-destructive py-6 font-mono text-xs">{error}</div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="border border-border rounded-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50">
                  <th className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground p-3 w-32">Metric</th>
                  {result.comparisons.map(c => (
                    <th key={c.ticker} className="text-left font-serif text-sm text-foreground p-3">
                      {c.ticker}
                      <div className="font-mono text-[10px] text-muted-foreground font-normal mt-0.5">
                        {priceFor(c.ticker) > 0 ? formatCurrency(priceFor(c.ticker)) : "—"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(({ key, label }) => (
                  <tr key={key} className="border-t border-border">
                    <td className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground p-3 align-top">{label}</td>
                    {result.comparisons.map(c => (
                      <td key={c.ticker} className="p-3 text-xs text-foreground align-top">{String(c[key])}</td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-border bg-secondary/20">
                  <td className="font-mono text-[10px] uppercase tracking-widest text-pine p-3 align-top">Bull Case</td>
                  {result.comparisons.map(c => {
                    const p = pct(c.bullPrice, priceFor(c.ticker));
                    return (
                      <td key={c.ticker} className="p-3 align-top">
                        <div className="font-mono text-sm text-pine">{formatCurrency(c.bullPrice)}</div>
                        {priceFor(c.ticker) > 0 && (
                          <div className="font-mono text-[10px] text-pine/80">{p >= 0 ? "+" : ""}{p.toFixed(1)}%</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-border bg-secondary/20">
                  <td className="font-mono text-[10px] uppercase tracking-widest text-destructive p-3 align-top">Bear Case</td>
                  {result.comparisons.map(c => {
                    const p = pct(c.bearPrice, priceFor(c.ticker));
                    return (
                      <td key={c.ticker} className="p-3 align-top">
                        <div className="font-mono text-sm text-destructive">{formatCurrency(c.bearPrice)}</div>
                        {priceFor(c.ticker) > 0 && (
                          <div className="font-mono text-[10px] text-destructive/80">{p >= 0 ? "+" : ""}{p.toFixed(1)}%</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-border bg-secondary/20">
                  <td className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground p-3 align-top">Risk</td>
                  {result.comparisons.map(c => {
                    const tone = c.riskPct >= 70 ? "text-destructive" : c.riskPct >= 40 ? "text-foreground" : "text-pine";
                    return (
                      <td key={c.ticker} className="p-3 align-top">
                        <Badge variant="outline" className={`font-mono text-xs ${tone}`}>{c.riskPct}/100</Badge>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {result.verdict && (
            <div className="border border-primary/40 bg-primary/5 rounded-sm p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">AI Verdict</div>
              <p className="text-sm text-foreground leading-relaxed">{result.verdict}</p>
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center text-muted-foreground py-10 font-mono text-xs">
          Select stocks above and hit Compare.
        </div>
      )}
    </div>
  );
}
