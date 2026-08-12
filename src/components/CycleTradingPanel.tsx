import { useMemo, useState, useEffect, useRef, KeyboardEvent } from "react";
import { useStockData } from "@/hooks/useStockData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Loader2, Plus, Sparkles, X, Waves } from "lucide-react";
import { formatCurrency } from "@/data/stocks";
import { toast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Scatter, ComposedChart,
} from "recharts";
import { getWatchlistSectors } from "@/components/ManageWatchlistDialog";

const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;

interface Pivot { date: string; close: number; type: "high" | "low" }
interface WindowStats {
  high: number; low: number; mid: number;
  highCount: number; lowCount: number; isCyclic: boolean; pivots: Pivot[];
}
interface CycleResult {
  ticker: string;
  currentPrice: number;
  position: "bottom" | "middle" | "top" | "unknown";
  positionPct: number;
  window3m: WindowStats;
  window6m: WindowStats;
  summary: string;
  history: { date: string; close: number }[];
}

export default function CycleTradingPanel() {
  const { data: quotes } = useStockData();
  const baseUniverse = useMemo(
    () => Array.from(new Set((quotes ?? []).map(q => q.ticker))).sort(),
    [quotes]
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [extraTickers, setExtraTickers] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [results, setResults] = useState<CycleResult[] | null>(null);
  const [mode, setMode] = useState<"evaluate" | "best" | null>(null);
  const [loading, setLoading] = useState(false);
  const [bestLoading, setBestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const universe = useMemo(
    () => Array.from(new Set([...baseUniverse, ...extraTickers])).sort(),
    [baseUniverse, extraTickers]
  );

  const toggle = (t: string) => {
    setSelected(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : prev.length >= 8 ? prev : [...prev, t]
    );
  };
  const remove = (t: string) => setSelected(prev => prev.filter(x => x !== t));

  const addCustom = () => {
    const t = newTicker.trim().toUpperCase();
    if (!TICKER_RE.test(t)) {
      toast({ title: "Invalid ticker", description: "Use 1–10 letters/digits/.-", variant: "destructive" });
      return;
    }
    setExtraTickers(prev => (prev.includes(t) ? prev : [...prev, t]));
    setSelected(prev => (prev.includes(t) ? prev : prev.length < 8 ? [...prev, t] : prev));
    setNewTicker("");
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addCustom(); }
  };

  const runEvaluate = async () => {
    if (selected.length === 0) return;
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("detect-cycles", {
        body: { tickers: selected, mode: "evaluate" },
      });
      if (error) throw error;
      setResults((data as any)?.results ?? []);
      setMode("evaluate");
    } catch (e: any) {
      setError(e?.message || "Failed to evaluate cycles");
    } finally { setLoading(false); }
  };

  const runBestPicks = async () => {
    const watchTickers = Array.from(new Set(getWatchlistSectors().flatMap(s => s.tickers)));
    const pool = Array.from(new Set([...watchTickers, ...selected])).slice(0, 12);
    if (pool.length === 0) {
      toast({ title: "No tickers available", description: "Add stocks to your watchlist first.", variant: "destructive" });
      return;
    }
    setBestLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("detect-cycles", {
        body: { tickers: pool, mode: "best" },
      });
      if (error) throw error;
      const picks = (data as any)?.results ?? [];
      setResults(picks);
      setMode("best");
      if (picks.length === 0) {
        toast({ title: "No cyclic bottoms found", description: "No stocks currently sit at the bottom of a repeating cycle." });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to find best picks");
    } finally { setBestLoading(false); }
  };

  // Auto-run best picks on mount
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    runBestPicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-sm p-4 bg-secondary/20">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-serif text-base text-foreground flex items-center gap-2">
              <Waves className="h-4 w-4 text-primary" /> Cycle Trading
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Detect repeating wave / cycle patterns over 3M and 6M. Find stocks currently sitting at the bottom of their cycle.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={runBestPicks} disabled={bestLoading} size="sm" variant="outline" className="gap-1.5 text-xs">
              {bestLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Find Best Picks
            </Button>
            {selected.length >= 1 && (
              <Button onClick={runEvaluate} disabled={loading} size="sm" className="gap-1.5 text-xs">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                Evaluate Cycle ({selected.length})
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
          {selected.length === 0 ? (
            <span className="text-[11px] text-muted-foreground font-mono">No tickers selected.</span>
          ) : selected.map(t => (
            <Badge key={t} variant="outline" className="font-mono text-xs gap-1 border-primary text-primary bg-primary/10">
              {t}
              <button onClick={() => remove(t)} className="hover:text-destructive" aria-label={`Remove ${t}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Input
            value={newTicker}
            onChange={e => setNewTicker(e.target.value.toUpperCase())}
            onKeyDown={onInputKey}
            placeholder="Add ticker (e.g. NVDA)"
            maxLength={10}
            className="h-8 text-xs font-mono w-44"
          />
          <Button onClick={addCustom} size="sm" variant="outline" className="gap-1 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>

        <ScrollArea className="h-28 border border-border rounded-sm bg-background p-2">
          <div className="flex flex-wrap gap-1.5">
            {universe.length === 0 && (
              <span className="text-xs text-muted-foreground font-mono">Loading tickers…</span>
            )}
            {universe.map(t => {
              const checked = selected.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle(t)}
                  className={`px-2 py-1 rounded-sm border text-xs font-mono transition-colors ${
                    checked
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-border bg-secondary/30 text-foreground hover:bg-secondary"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {error && (
        <div className="text-center text-destructive py-6 font-mono text-xs">{error}</div>
      )}

      {results && mode === "best" && results.length > 0 && (
        <div className="border border-primary/40 bg-primary/5 rounded-sm p-3 text-xs font-mono text-primary">
          Best cycle-bottom picks: {results.map(r => r.ticker).join(", ")}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-6">
          {results.map(r => <CycleCard key={r.ticker} r={r} />)}
        </div>
      )}

      {results && results.length === 0 && !loading && !bestLoading && (
        <div className="text-center text-muted-foreground py-10 font-mono text-xs">
          No results to display.
        </div>
      )}
    </div>
  );
}

function CycleCard({ r }: { r: CycleResult }) {
  const pivotsByDate = useMemo(() => {
    const m: Record<string, Pivot> = {};
    for (const p of r.window6m.pivots) m[p.date] = p;
    return m;
  }, [r]);

  const chartData = useMemo(
    () => r.history.map(p => ({
      date: p.date,
      close: p.close,
      high: pivotsByDate[p.date]?.type === "high" ? p.close : null,
      low: pivotsByDate[p.date]?.type === "low" ? p.close : null,
    })),
    [r, pivotsByDate]
  );

  const positionTone =
    r.position === "bottom" ? "text-pine" :
    r.position === "top" ? "text-destructive" : "text-foreground";

  return (
    <div className="border border-border rounded-sm overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-2 p-3 bg-secondary/30 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="font-serif text-base text-foreground">{r.ticker}</span>
          <span className="font-mono text-sm text-foreground">{formatCurrency(r.currentPrice)}</span>
          <Badge variant="outline" className={`font-mono text-[10px] uppercase ${positionTone}`}>
            {r.position} · {r.positionPct.toFixed(0)}% of 6M range
          </Badge>
          {(r.window3m.isCyclic || r.window6m.isCyclic) ? (
            <Badge className="font-mono text-[10px] bg-primary/20 text-primary border-primary/40">CYCLIC</Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">NO CLEAR CYCLE</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border text-xs">
        {([["3M", r.window3m], ["6M", r.window6m]] as const).map(([label, w]) => (
          <div key={label} className="bg-card p-3 space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label} Window</div>
            <div className="grid grid-cols-3 gap-2">
              <div><div className="text-[10px] text-muted-foreground font-mono">High</div><div className="font-mono text-destructive">{formatCurrency(w.high)}</div></div>
              <div><div className="text-[10px] text-muted-foreground font-mono">Mid</div><div className="font-mono text-foreground">{formatCurrency(w.mid)}</div></div>
              <div><div className="text-[10px] text-muted-foreground font-mono">Low</div><div className="font-mono text-pine">{formatCurrency(w.low)}</div></div>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {w.highCount} highs · {w.lowCount} lows · {w.isCyclic ? "cyclic" : "not cyclic"}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 text-xs text-muted-foreground">{r.summary}</div>

      <div className="h-64 px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(d: string) => {
                const dt = new Date(d);
                return `${dt.toLocaleString("en", { month: "short" })} ${dt.getDate()}`;
              }}
              minTickGap={32}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              width={52}
            />
            <Tooltip
              contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
              formatter={(v: any, name: string) => name === "close" ? [`$${Number(v).toFixed(2)}`, "Close"] : [v, name]}
            />
            <ReferenceLine y={r.window6m.high} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `6M High ${r.window6m.high}`, fontSize: 10, fill: "hsl(var(--destructive))", position: "insideTopRight" }} />
            <ReferenceLine y={r.window6m.mid} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 4" />
            <ReferenceLine y={r.window6m.low} stroke="hsl(142 70% 45%)" strokeDasharray="4 4" label={{ value: `6M Low ${r.window6m.low}`, fontSize: 10, fill: "hsl(142 70% 45%)", position: "insideBottomRight" }} />
            <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Scatter dataKey="high" fill="hsl(var(--destructive))" shape="triangle" />
            <Scatter dataKey="low" fill="hsl(142 70% 45%)" shape="circle" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
