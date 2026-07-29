import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { loadFromCache, saveLocalCache } from "@/lib/cacheClient";
import { SectorGroup } from "@/data/stocks";
import { RefreshCw, TrendingUp, TrendingDown, ShieldAlert, Activity, PieChart as PieIcon, ChevronDown } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

interface Holding {
  ticker: string; sector: string; value: number; gain: number;
  returnPct: number; volatility: number; maxDrawdown: number; weight: number;
}
interface Analytics {
  horizon: string; invested: number; currentValue: number; gain: number; returnPct: number;
  benchmarks: Record<string, number>; alphaVsSpy: number;
  risk: { volatility: number; maxDrawdown: number; beta: number; sharpe: number };
  scores: { health: number; performance: number; risk: number; diversification: number; consistency: number };
  allocation: { sector: string; value: number; weight: number }[];
  holdings: Holding[];
  chart: { date: string; portfolio: number; SPY: number | null; VOO: number | null }[];
  skipped: string[];
}

const TTL = 6 * 60 * 60 * 1000;
const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, var(--primary)))", "#22c55e", "#eab308", "#06b6d4", "#a855f7", "#f97316", "#ec4899", "#64748b"];

const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const toneCls = (v: number) => (v >= 0 ? "text-success" : "text-destructive");

function scoreTone(score: number) {
  if (score >= 70) return { label: "Healthy", cls: "text-success", bar: "bg-success" };
  if (score >= 45) return { label: "Balanced", cls: "text-warning", bar: "bg-warning" };
  return { label: "Fragile", cls: "text-destructive", bar: "bg-destructive" };
}

export default function PortfolioSummaryDialog({
  open, onOpenChange, sectors,
}: { open: boolean; onOpenChange: (v: boolean) => void; sectors: SectorGroup[] }) {
  const [horizon, setHorizon] = useState<"6m" | "12m">("6m");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const tickers = Array.from(new Set(sectors.flatMap((s) => s.tickers)));
  const sectorMap: Record<string, string> = {};
  sectors.forEach((s) => s.tickers.forEach((t) => { sectorMap[t] = s.name; }));
  const cacheKey = `portfolio-analytics:${horizon}:${[...tickers].sort().join(",")}`;

  const run = async (force = false) => {
    if (tickers.length === 0) return;
    setLoading(true); setError(null);
    try {
      if (!force) {
        const cached = await loadFromCache<Analytics>(cacheKey, TTL);
        if (cached) { setData(cached); setLoading(false); return; }
      }
      const { data: res, error: err } = await supabase.functions.invoke("portfolio-analytics", {
        body: { tickers, horizon, sectorMap },
      });
      if (err) throw err;
      if (res?.error) throw new Error(res.error);
      setData(res as Analytics);
      saveLocalCache(cacheKey, res, TTL);
    } catch (e) {
      setError((e as Error).message || "Could not build your summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, horizon]);

  const tone = data ? scoreTone(data.scores.health) : null;
  const visibleHoldings = data ? (showAll ? data.holdings : data.holdings.slice(0, 8)) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-wide flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Portfolio Pulse
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-1">
          <div className="flex rounded-sm border border-border overflow-hidden">
            {(["6m", "12m"] as const).map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 text-[11px] font-mono transition-colors ${horizon === h ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              >
                {h === "6m" ? "6 Months" : "12 Months"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs ml-auto" onClick={() => run(true)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loading && <div className="py-20 text-center font-mono text-sm text-muted-foreground">Crunching {tickers.length} holdings…</div>}
        {!loading && error && <div className="py-16 text-center font-mono text-sm text-destructive">{error}</div>}

        {!loading && !error && data && (
          <div className="space-y-5">
            {/* Hero stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border border-border rounded-sm p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">$1,000 each → now</div>
                <div className="font-mono text-lg">{money(data.currentValue)}</div>
                <div className={`text-xs font-mono ${toneCls(data.gain)}`}>{data.gain >= 0 ? "+" : "-"}{money(Math.abs(data.gain))} on {money(data.invested)}</div>
              </div>
              <div className="border border-border rounded-sm p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Return</div>
                <div className={`font-mono text-lg ${toneCls(data.returnPct)}`}>{pct(data.returnPct)}</div>
                <div className="text-xs font-mono text-muted-foreground">over {horizon === "6m" ? "6 months" : "12 months"}</div>
              </div>
              <div className="border border-border rounded-sm p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">vs SPY</div>
                <div className={`font-mono text-lg ${toneCls(data.alphaVsSpy)}`}>{pct(data.alphaVsSpy)}</div>
                <div className="text-xs font-mono text-muted-foreground">
                  SPY {pct(data.benchmarks.SPY ?? 0)} · VOO {pct(data.benchmarks.VOO ?? 0)}
                </div>
              </div>
              <div className="border border-border rounded-sm p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Health Score</div>
                <div className={`font-mono text-lg ${tone!.cls}`}>{data.scores.health}/100</div>
                <div className={`text-xs font-mono ${tone!.cls}`}>{tone!.label}</div>
              </div>
            </div>

            {/* Growth chart */}
            <section>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                Growth of {money(data.invested)} — you vs benchmarks
              </h3>
              <div className="h-[240px] border border-border rounded-sm p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" minTickGap={40} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <RTooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                      formatter={(v: number, n: string) => [money(v), n]}
                    />
                    <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="SPY" name="SPY" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="VOO" name="VOO" stroke="#eab308" strokeWidth={1.5} dot={false} strokeDasharray="2 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Allocation + risk */}
            <div className="grid md:grid-cols-2 gap-4">
              <section>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <PieIcon className="h-3.5 w-3.5" /> Allocation by sector
                </h3>
                <div className="h-[200px] border border-border rounded-sm p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.allocation} dataKey="weight" nameKey="sector" innerRadius={42} outerRadius={72} paddingAngle={2}>
                        {data.allocation.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <RTooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                        formatter={(v: number, n: string) => [`${v}%`, n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {data.allocation.slice(0, 6).map((a, i) => (
                    <Badge key={a.sector} variant="outline" className="text-[10px] font-mono gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {a.sector} {a.weight}%
                    </Badge>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" /> Risk & health breakdown
                </h3>
                <div className="border border-border rounded-sm p-3 space-y-2">
                  {([
                    ["Performance", data.scores.performance],
                    ["Risk control", data.scores.risk],
                    ["Diversification", data.scores.diversification],
                    ["Consistency", data.scores.consistency],
                  ] as const).map(([label, v]) => (
                    <div key={label}>
                      <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                        <span>{label}</span><span>{v}/100</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${scoreTone(v).bar}`} style={{ width: `${Math.max(2, v)}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                    <div>Volatility <span className="text-foreground">{data.risk.volatility}%</span></div>
                    <div>Max drawdown <span className="text-destructive">{data.risk.maxDrawdown}%</span></div>
                    <div>Beta vs SPY <span className="text-foreground">{data.risk.beta}</span></div>
                    <div>Sharpe <span className="text-foreground">{data.risk.sharpe}</span></div>
                  </div>
                </div>
              </section>
            </div>

            {/* Per-stock drill-down */}
            <section>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                Winners & laggards ($1,000 each)
              </h3>
              <div className="h-[220px] border border-border rounded-sm p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.holdings} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="ticker" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-45} textAnchor="end" height={46} />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v}%`} />
                    <RTooltip
                      cursor={{ fill: "hsl(var(--secondary))", opacity: 0.3 }}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`, "Return"]}
                    />
                    <Bar dataKey="returnPct" radius={[2, 2, 0, 0]}>
                      {data.holdings.map((h) => (
                        <Cell key={h.ticker} fill={h.returnPct >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 border border-border rounded-sm divide-y divide-border">
                {visibleHoldings.map((h) => (
                  <div key={h.ticker} className="flex items-center gap-3 px-3 py-1.5 text-[11px] font-mono">
                    <span className="w-14 text-foreground">{h.ticker}</span>
                    <span className="hidden sm:inline text-muted-foreground w-36 truncate">{h.sector}</span>
                    <span className={`w-20 text-right ${toneCls(h.returnPct)}`}>
                      {h.returnPct >= 0 ? <TrendingUp className="inline h-3 w-3 mr-1" /> : <TrendingDown className="inline h-3 w-3 mr-1" />}
                      {pct(h.returnPct)}
                    </span>
                    <span className="w-20 text-right text-muted-foreground">{money(h.value)}</span>
                    <span className="w-16 text-right text-muted-foreground">{h.weight}%</span>
                    <span className="hidden sm:inline w-24 text-right text-muted-foreground">vol {h.volatility}%</span>
                  </div>
                ))}
                {data.holdings.length > 8 && (
                  <button
                    onClick={() => setShowAll((s) => !s)}
                    className="w-full py-1.5 text-[11px] font-mono text-primary hover:bg-secondary/50 flex items-center justify-center gap-1"
                  >
                    <ChevronDown className={`h-3 w-3 transition-transform ${showAll ? "rotate-180" : ""}`} />
                    {showAll ? "Show less" : `Show all ${data.holdings.length} holdings`}
                  </button>
                )}
              </div>
            </section>

            {data.skipped.length > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground">
                No price history for: {data.skipped.join(", ")}
              </p>
            )}
            <p className="text-[10px] font-mono text-muted-foreground">
              Simulation assumes an equal $1,000 buy per holding at the start of the window, held to today. Informational only — not investment advice.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
