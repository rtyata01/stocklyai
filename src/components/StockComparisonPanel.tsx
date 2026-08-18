import { useMemo, useState, KeyboardEvent } from "react";
import { useStockData } from "@/hooks/useStockData";
import { supabase } from "@/integrations/supabase/client";
import { loadFromCache, saveLocalCache } from "@/lib/cacheClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, Globe2, Plus, X, Shuffle, Tag, TrendingUp, ShieldCheck, Swords } from "lucide-react";
import { formatCurrency } from "@/data/stocks";
import { toast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

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

interface HistoryPoint { date: string; close: number }
interface HistorySeries { ticker: string; points: HistoryPoint[] }

interface ComparisonResult {
  comparisons: ComparisonRow[];
  verdict: string;
  tickers?: string[];
  mode?: "compare" | "market";
  history?: HistorySeries[];
  prices?: Record<string, number>;
}

interface AlternativeItem {
  ticker: string;
  name: string;
  reason: string;
  metric: string;
}

interface AlternativesResult {
  base: string;
  basePrice: number;
  prices: Record<string, number>;
  summary: string;
  cheaper: AlternativeItem[];
  higherGrowth: AlternativeItem[];
  lowerRisk: AlternativeItem[];
  bestCompetitors: AlternativeItem[];
}

const ALT_SECTIONS: {
  key: keyof Pick<AlternativesResult, "cheaper" | "higherGrowth" | "lowerRisk" | "bestCompetitors">;
  label: string;
  Icon: typeof Tag;
  tone: string;
}[] = [
  { key: "cheaper", label: "Cheaper Alternatives", Icon: Tag, tone: "text-primary" },
  { key: "higherGrowth", label: "Higher-Growth Alternatives", Icon: TrendingUp, tone: "text-pine" },
  { key: "lowerRisk", label: "Lower-Risk Alternatives", Icon: ShieldCheck, tone: "text-muted-foreground" },
  { key: "bestCompetitors", label: "Best Competitors", Icon: Swords, tone: "text-destructive" },
];


const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_VERSION = "v2"; // bump to invalidate caches missing history
const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;

const ROWS: { key: keyof ComparisonRow; label: string }[] = [
  { key: "growth", label: "Growth" },
  { key: "margins", label: "Margins" },
  { key: "tam", label: "TAM" },
  { key: "valuation", label: "Valuation" },
  { key: "aiPositioning", label: "AI Positioning" },
  { key: "moat", label: "Moat" },
];

const RANGES: { key: string; label: string; days: number }[] = [
  { key: "3M", label: "3M", days: 90 },
  { key: "6M", label: "6M", days: 180 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "2Y", label: "2Y", days: 730 },
];

const SERIES_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(142 70% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 70% 60%)",
  "hsl(200 80% 55%)",
  "hsl(20 80% 55%)",
  "hsl(160 60% 45%)",
];


export default function StockComparisonPanel() {
  const { data: quotes } = useStockData();
  const baseUniverse = useMemo(
    () => Array.from(new Set((quotes ?? []).map(q => q.ticker))).sort(),
    [quotes]
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [extraTickers, setExtraTickers] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<string>("1Y");
  const [alternatives, setAlternatives] = useState<AlternativesResult | null>(null);
  const [altLoading, setAltLoading] = useState(false);
  const [altError, setAltError] = useState<string | null>(null);

  const chartData = useMemo(() => {
    if (!result?.history?.length) return { data: [] as any[], tickers: [] as string[] };
    const range = RANGES.find(r => r.key === rangeKey) ?? RANGES[2];
    const cutoffMs = Date.now() - range.days * 24 * 60 * 60 * 1000;
    const tickers = result.history.map(h => h.ticker);
    // Build normalized % change series from first in-range point
    const dateSet = new Set<string>();
    const baseMap: Record<string, number> = {};
    const seriesByDate: Record<string, Record<string, number>> = {};
    for (const h of result.history) {
      const inRange = h.points.filter(p => Date.parse(p.date) >= cutoffMs);
      if (inRange.length === 0) continue;
      baseMap[h.ticker] = inRange[0].close;
      for (const p of inRange) {
        dateSet.add(p.date);
        if (!seriesByDate[p.date]) seriesByDate[p.date] = {};
        seriesByDate[p.date][h.ticker] = +(((p.close - baseMap[h.ticker]) / baseMap[h.ticker]) * 100).toFixed(2);
      }
    }
    const sortedDates = Array.from(dateSet).sort();
    const data = sortedDates.map(date => ({ date, ...seriesByDate[date] }));
    return { data, tickers };
  }, [result, rangeKey]);


  const universe = useMemo(
    () => Array.from(new Set([...baseUniverse, ...extraTickers])).sort(),
    [baseUniverse, extraTickers]
  );

  const toggle = (t: string) => {
    setSelected(prev => {
      if (prev.includes(t)) return prev.filter(x => x !== t);
      if (prev.length >= 8) return prev;
      return [...prev, t];
    });
  };

  const remove = (t: string) => setSelected(prev => prev.filter(x => x !== t));

  const addCustom = () => {
    const t = newTicker.trim().toUpperCase();
    if (!TICKER_RE.test(t)) {
      toast({ title: "Invalid ticker", description: "Use 1–10 letters/digits/.-", variant: "destructive" });
      return;
    }
    setExtraTickers(prev => prev.includes(t) ? prev : [...prev, t]);
    setSelected(prev => prev.includes(t) ? prev : (prev.length < 8 ? [...prev, t] : prev));
    setNewTicker("");
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addCustom(); }
  };

  const runCompare = async (mode: "compare" | "market" = "compare") => {
    if (mode === "compare" && selected.length < 2) return;
    if (mode === "market" && selected.length !== 1) return;
    mode === "market" ? setMarketLoading(true) : setLoading(true);
    setError(null);
    const tickers = [...selected].sort();
    const key = `stock-comparison:${CACHE_VERSION}:${mode}:${tickers.join(",")}`;
    try {
      if (mode === "compare") {
        const cached = await loadFromCache<ComparisonResult>(key, CACHE_TTL);
        if (cached) { setResult(cached); return; }
      }
      const { data, error } = await supabase.functions.invoke("compare-stocks", {
        body: { tickers, mode },
      });
      if (error) throw error;
      saveLocalCache(key, data, CACHE_TTL);
      setResult(data as ComparisonResult);
    } catch (e: any) {
      setError(e?.message || "Failed to compare");
    } finally {
      setLoading(false);
      setMarketLoading(false);
    }
  };

  const runAlternatives = async () => {
    if (selected.length !== 1) return;
    const base = selected[0];
    setAltLoading(true);
    setAltError(null);
    const key = `market-alternatives:${base}`;
    try {
      const cached = await loadFromCache<AlternativesResult>(key, CACHE_TTL);
      if (cached) { setAlternatives(cached); return; }
      const { data, error } = await supabase.functions.invoke("market-alternatives", {
        body: { ticker: base },
      });
      if (error) throw error;
      saveLocalCache(key, data, CACHE_TTL);
      setAlternatives(data as AlternativesResult);
    } catch (e: any) {
      setAltError(e?.message || "Failed to find alternatives");
    } finally {
      setAltLoading(false);
    }
  };

  const priceFor = (t: string) => quotes?.find(q => q.ticker === t)?.price ?? 0;
  const pct = (target: number, current: number) =>
    current > 0 ? ((target - current) / current) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-sm p-4 bg-secondary/20">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-serif text-base text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Stock Comparison
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Pick 2–8 stocks for a head-to-head AI breakdown. Add custom tickers, or select exactly one for Market Compare and Market Alternatives.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <Button
              onClick={runAlternatives}
              disabled={selected.length !== 1 || altLoading}
              size="sm"
              variant="secondary"
              className="gap-1.5 text-xs"
              title={selected.length !== 1 ? "Select exactly one stock to find alternatives" : undefined}
            >
              {altLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
              Market Alternatives
            </Button>
            {selected.length === 1 && (
              <Button onClick={() => runCompare("market")} disabled={marketLoading} size="sm" variant="outline" className="gap-1.5 text-xs">
                {marketLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
                Market Compare
              </Button>
            )}
            <Button onClick={() => runCompare("compare")} disabled={selected.length < 2 || loading} size="sm" className="gap-1.5 text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Compare ({selected.length})
            </Button>
          </div>
        </div>

        {/* Selected chips */}
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

        {/* Add custom */}
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

      {altError && (
        <div className="text-center text-destructive py-4 font-mono text-xs">{altError}</div>
      )}

      {alternatives && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h4 className="font-serif text-sm text-foreground">
              Market Alternatives to <span className="text-primary">{alternatives.base}</span>
              {alternatives.basePrice > 0 && (
                <span className="font-mono text-[11px] text-muted-foreground ml-2">
                  {formatCurrency(alternatives.basePrice)}
                </span>
              )}
            </h4>
            <button
              onClick={() => setAlternatives(null)}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>

          {alternatives.summary && (
            <p className="text-xs text-foreground leading-relaxed border border-primary/40 bg-primary/5 rounded-sm p-3">
              {alternatives.summary}
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {ALT_SECTIONS.map(({ key, label, Icon, tone }) => {
              const items = alternatives[key] ?? [];
              return (
                <div key={key} className="border border-border rounded-sm bg-secondary/10 p-3">
                  <div className={`flex items-center gap-1.5 mb-2 font-mono text-[10px] uppercase tracking-widest ${tone}`}>
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </div>
                  {items.length === 0 ? (
                    <div className="text-[11px] font-mono text-muted-foreground">No matches found.</div>
                  ) : (
                    <ul className="space-y-2">
                      {items.map(item => {
                        const p = alternatives.prices?.[item.ticker] ?? 0;
                        return (
                          <li key={item.ticker} className="border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="font-serif text-sm text-foreground">{item.ticker}</span>
                                <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                {p > 0 && (
                                  <span className="font-mono text-xs text-foreground tabular-nums">{formatCurrency(p)}</span>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[10px] font-mono"
                                  onClick={() => {
                                    setExtraTickers(prev => prev.includes(item.ticker) ? prev : [...prev, item.ticker]);
                                    setSelected(prev =>
                                      prev.includes(item.ticker) || prev.length >= 8 ? prev : [...prev, item.ticker]
                                    );
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-0.5" /> Compare
                                </Button>
                              </span>
                            </div>
                            {item.metric && (
                              <Badge variant="outline" className="mt-1 font-mono text-[10px]">{item.metric}</Badge>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{item.reason}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.mode === "market" && (
            <div className="text-[11px] font-mono text-muted-foreground">
              Market peers auto-selected: {result.comparisons.map(c => c.ticker).join(", ")}
            </div>
          )}
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
                    const cur = priceFor(c.ticker);
                    const p = pct(c.bullPrice, cur);
                    return (
                      <td key={c.ticker} className="p-3 align-top">
                        <div className="font-mono text-sm text-pine">{formatCurrency(c.bullPrice)}</div>
                        {cur > 0 && (
                          <div className="font-mono text-[10px] text-pine/80">{p >= 0 ? "+" : ""}{p.toFixed(1)}%</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-border bg-secondary/20">
                  <td className="font-mono text-[10px] uppercase tracking-widest text-destructive p-3 align-top">Bear Case</td>
                  {result.comparisons.map(c => {
                    const cur = priceFor(c.ticker);
                    const p = pct(c.bearPrice, cur);
                    return (
                      <td key={c.ticker} className="p-3 align-top">
                        <div className="font-mono text-sm text-destructive">{formatCurrency(c.bearPrice)}</div>
                        {cur > 0 && (
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

          {chartData.tickers.length > 0 && chartData.data.length > 1 && (
            <div className="border border-border rounded-sm p-4 bg-secondary/10">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h4 className="font-serif text-sm text-foreground">Price Performance</h4>
                  <p className="text-[11px] text-muted-foreground font-mono">% change normalized to range start</p>
                </div>
                <div className="flex items-center gap-1">
                  {RANGES.map(r => (
                    <button
                      key={r.key}
                      onClick={() => setRangeKey(r.key)}
                      className={`px-2 py-1 rounded-sm text-[11px] font-mono border transition-colors ${
                        rangeKey === r.key
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(d: string) => {
                        const dt = new Date(d);
                        return `${dt.toLocaleString("en", { month: "short" })} ${String(dt.getFullYear()).slice(2)}`;
                      }}
                      minTickGap={40}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                      formatter={(v: any, name: string) => [`${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {chartData.tickers.map((t, i) => (
                      <Line
                        key={t}
                        type="monotone"
                        dataKey={t}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
                {chartData.tickers.map(t => {
                  const cur = result?.prices?.[t] ?? priceFor(t);
                  return cur > 0 ? (
                    <span key={t}>
                      <span className="text-foreground">{t}</span>: {formatCurrency(cur)}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}



          {result.verdict && (
            <div className="border border-primary/40 bg-primary/5 rounded-sm p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">AI Verdict</div>
              <p className="text-sm text-foreground leading-relaxed">{result.verdict}</p>
            </div>
          )}
        </div>
      )}

      {!result && !loading && !marketLoading && !error && (
        <div className="text-center text-muted-foreground py-10 font-mono text-xs">
          Select 2+ stocks and hit Compare — or pick 1 and use Market Compare.
        </div>
      )}
    </div>
  );
}
