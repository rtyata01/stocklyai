import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { loadFromCache, saveLocalCache } from "@/lib/cacheClient";
import { SectorGroup } from "@/data/stocks";
import { RefreshCw, Newspaper, Zap, AlertTriangle, Sparkles, CalendarDays } from "lucide-react";

interface Driver {
  ticker: string; weekPct: number; monthPct: number; price: number;
  contributionPct: number; direction: "gain" | "loss";
}
interface Briefing {
  generatedAt: string;
  portfolioWeekPct: number;
  spyWeekPct: number;
  alphaPct: number;
  drivers: Driver[];
  upcoming: { ticker: string; earningsDate: string | null; dividendDate: string | null; dividendYield: number | null }[];
  executiveSummary: string;
  driverBullets?: string[];
  risks: string[];
  opportunities: string[];
}

const TTL = 6 * 60 * 60 * 1000;
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const toneCls = (v: number) => (v >= 0 ? "text-pine" : "text-destructive");

export default function PortfolioBriefingDialog({
  open, onOpenChange, sectors,
}: { open: boolean; onOpenChange: (v: boolean) => void; sectors: SectorGroup[] }) {
  const [data, setData] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickers = Array.from(new Set(sectors.flatMap((s) => s.tickers)));
  const cacheKey = `portfolio-briefing:${[...tickers].sort().join(",")}`;

  const run = async (force = false) => {
    if (tickers.length === 0) return;
    setLoading(true); setError(null);
    try {
      if (!force) {
        const cached = await loadFromCache<Briefing>(cacheKey, TTL);
        if (cached) { setData(cached); setLoading(false); return; }
      }
      const { data: res, error: err } = await supabase.functions.invoke("portfolio-briefing", {
        body: { tickers },
      });
      if (err) throw err;
      if (res?.error) throw new Error(res.error);
      setData(res);
      saveLocalCache(cacheKey, res, TTL);
    } catch (e) {
      setError((e as Error).message || "Could not build your briefing.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const driverBullets: string[] = Array.isArray(data?.driverBullets) ? data!.driverBullets! : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-wide flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" /> The Weekly Debrief
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => run(true)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Regenerate
          </Button>
        </div>

        {loading && <div className="py-20 text-center font-mono text-sm text-muted-foreground">Writing your briefing…</div>}
        {!loading && error && <div className="py-16 text-center font-mono text-sm text-destructive">{error}</div>}

        {!loading && !error && data && (
          <div className="space-y-5">
            <section className="border border-primary/40 bg-primary/5 rounded-sm p-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Executive summary</div>
              <p className="text-sm leading-relaxed">{data.executiveSummary}</p>
              <div className="flex flex-wrap gap-4 mt-3 font-mono text-xs">
                <span>Portfolio <span className={toneCls(data.portfolioWeekPct)}>{pct(data.portfolioWeekPct)}</span></span>
                <span>SPY <span className={toneCls(data.spyWeekPct)}>{pct(data.spyWeekPct)}</span></span>
                <span>Alpha <span className={toneCls(data.alphaPct)}>{pct(data.alphaPct)}</span></span>
              </div>
            </section>

            <section>
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" /> What moved the needle
              </h3>
              {driverBullets.length > 0 && (
                <ul className="space-y-1.5 mb-3">
                  {driverBullets.map((d, i) => (
                    <li key={i} className="text-xs leading-relaxed flex gap-2">
                      <span className="text-primary">▸</span>{d}
                    </li>
                  ))}
                </ul>
              )}
              <div className="border border-border rounded-sm divide-y divide-border">
                {data.drivers.map((d) => (
                    <div key={d.ticker} className="px-3 py-2">
                      <div className="flex items-center gap-3 text-[11px] font-mono">
                        <span className="w-14">{d.ticker}</span>
                        <span className={`w-20 text-right ${toneCls(d.weekPct)}`}>{pct(d.weekPct)}</span>
                        <span className="w-24 text-right text-muted-foreground">1M {pct(d.monthPct)}</span>
                        <span className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden ml-2">
                          <span
                            className={`block h-full ${d.direction === "gain" ? "bg-pine" : "bg-destructive"}`}
                            style={{ width: `${Math.min(100, d.contributionPct)}%` }}
                          />
                        </span>
                        <span className="w-28 text-right text-muted-foreground">
                          {d.contributionPct}% of {d.direction}s
                        </span>
                      </div>
                    </div>
                ))}
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-4">
              <section>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Risks on the radar
                </h3>
                <ul className="space-y-1.5 border border-border rounded-sm p-3">
                  {data.risks?.length ? data.risks.map((r, i) => (
                    <li key={i} className="text-xs leading-relaxed flex gap-2"><span className="text-destructive">▸</span>{r}</li>
                  )) : <li className="text-xs text-muted-foreground">No material risks flagged this week.</li>}
                </ul>
              </section>

              <section>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-pine" /> Opportunities ahead
                </h3>
                <ul className="space-y-1.5 border border-border rounded-sm p-3">
                  {data.opportunities?.length ? data.opportunities.map((o, i) => (
                    <li key={i} className="text-xs leading-relaxed flex gap-2"><span className="text-pine">▸</span>{o}</li>
                  )) : <li className="text-xs text-muted-foreground">Nothing notable queued up.</li>}
                </ul>
              </section>
            </div>

            {data.upcoming?.length > 0 && (
              <section>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Calendar — earnings & dividends
                </h3>
                <div className="border border-border rounded-sm divide-y divide-border">
                  {data.upcoming.map((u) => (
                    <div key={u.ticker} className="flex items-center gap-3 px-3 py-1.5 text-[11px] font-mono">
                      <span className="w-14">{u.ticker}</span>
                      <span className="w-40 text-muted-foreground">{u.earningsDate ? `Earnings ${u.earningsDate}` : "—"}</span>
                      <span className="w-40 text-muted-foreground">{u.dividendDate ? `Dividend ${u.dividendDate}` : "—"}</span>
                      <span className="text-muted-foreground">{u.dividendYield ? `${u.dividendYield}% yield` : ""}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="text-[10px] font-mono text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString()} · equal-weight $1,000 per holding · informational only, not investment advice.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
