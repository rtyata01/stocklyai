import { useState } from "react";
import { useSwingSignals, clearSwingCache, SwingSignal } from "@/hooks/useSwingSignals";
import { useStockData } from "@/hooks/useStockData";
import { usePriceEvaluations, PriceEvaluation } from "@/hooks/usePriceEvaluations";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Activity, FlaskConical, Trophy, TrendingUp, Rocket, Users, Flame, Wind, BarChart3, ExternalLink, HelpCircle } from "lucide-react";

const HELP = {
  current: "Live market price from Yahoo Finance / Alpha Vantage. Entry/Target/Stop are anchored to this price.",
  entry: "BUY zone — aligned with the Portfolio BUY column: aggregated from analyst consensus, intrinsic value (forward EPS × peer P/E), PEG < 1 signal, and 15–30% margin-of-safety guardrail. For swing trades we use the catalyst-adjusted BUY level.",
  target: "SELL zone — aligned with the Portfolio SELL column: aggregated from analyst targets, intrinsic value ceiling, PEG > 1.5 flag, and short-term catalyst upside (FDA, contract win, breakout).",
  stop: "Maximum downside before exiting — typically ~7% below the BUY entry to cap losses if the catalyst fails.",
};

const SIGNAL_META: Record<SwingSignal["signal_type"], { label: string; icon: any; color: string }> = {
  FDA_APPROVAL:      { label: "FDA Approval",      icon: FlaskConical, color: "text-pine border-pine/40 bg-pine/10" },
  CONTRACT_WIN:      { label: "Contract Win",      icon: Trophy,       color: "text-primary border-primary/40 bg-primary/10" },
  ANALYST_UPGRADE:   { label: "Analyst Upgrade",   icon: TrendingUp,   color: "text-primary border-primary/40 bg-primary/10" },
  PRODUCT_LAUNCH:    { label: "Product Launch",    icon: Rocket,       color: "text-primary border-primary/40 bg-primary/10" },
  INSIDER_BUYING:    { label: "Insider Buying",    icon: Users,        color: "text-pine border-pine/40 bg-pine/10" },
  SHORT_SQUEEZE:     { label: "Short Squeeze",     icon: Flame,        color: "text-destructive border-destructive/40 bg-destructive/10" },
  SECTOR_TAILWIND:   { label: "Sector Tailwind",   icon: Wind,         color: "text-primary border-primary/40 bg-primary/10" },
  TECHNICAL_BREAKOUT:{ label: "Tech Breakout",     icon: BarChart3,    color: "text-primary border-primary/40 bg-primary/10" },
};

const confColor = (c: string) =>
  c === "High" ? "text-pine" : c === "Medium" ? "text-yellow-500" : "text-destructive";

const SignalCard = ({ s, livePrice, ev }: { s: SwingSignal; livePrice?: number; ev?: PriceEvaluation }) => {
  const meta = SIGNAL_META[s.signal_type];
  const Icon = meta.icon;
  const current = livePrice && livePrice > 0 ? livePrice : s.current_price;
  // Align with BUY/HOLD/SELL framework when evaluation exists; keep catalyst-driven values otherwise
  const entry = ev ? ev.buyPrice : s.entry_price;
  const target = ev ? Math.max(ev.salePrice, s.target_price) : s.target_price;
  const stop = ev ? +(ev.buyPrice * 0.93).toFixed(2) : s.stop_loss;
  const upside = ((target - current) / Math.max(0.01, current)) * 100;
  const rr = ((target - entry) / Math.max(0.01, entry - stop)).toFixed(2);
  const evalNote = ev?.reasoning ? ` Portfolio evaluation: ${ev.reasoning}` : "";

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary text-primary-foreground font-mono text-sm px-2.5 py-0.5">{s.ticker}</Badge>
            <span className="text-sm text-muted-foreground font-mono">{s.company_name}</span>
            <Badge variant="outline" className={`text-[10px] font-mono inline-flex items-center gap-1 ${meta.color}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </Badge>
            <Badge variant="outline" className={`text-[10px] font-mono ${confColor(s.confidence)}`}>{s.confidence}</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">Hold ~{s.holding_days}d</Badge>
            <Badge variant="outline" className="text-[10px] font-mono">R:R 1:{rr}</Badge>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">{s.event_date}</div>
        </div>
        <h3 className="font-serif text-base text-foreground mt-2 leading-snug">{s.headline}</h3>
      </div>

      <div className="grid grid-cols-4 border-b border-border">
        <Stat label="Current" value={`$${current.toFixed(2)}`} help={HELP.current} />
        <Stat label="Entry · BUY" value={`$${entry.toFixed(2)}`} help={HELP.entry + evalNote} className="text-pine" />
        <Stat label="Target · SELL" value={`$${target.toFixed(2)}`} sub={`+${upside.toFixed(1)}%`} help={HELP.target + evalNote} className="text-primary" />
        <Stat label="Stop" value={`$${stop.toFixed(2)}`} help={HELP.stop} className="text-destructive" />
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Details</div>
          <p className="text-sm text-foreground leading-relaxed">{s.details}</p>
        </div>
        <div>
          <div className="text-[10px] font-mono text-primary uppercase tracking-widest mb-1">Why short-term upside</div>
          <p className="text-sm text-foreground leading-relaxed">{s.why_it_matters}</p>
        </div>
        {s.source_url && (
          <a href={s.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono">
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, sub, help, className = "" }: { label: string; value: string; sub?: string; help?: string; className?: string }) => (
  <div className="p-3 text-center border-r border-border last:border-r-0">
    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 inline-flex items-center justify-center gap-1">
      {label}
      {help && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground/60 hover:text-foreground"><HelpCircle className="h-3 w-3" /></button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{help}</TooltipContent>
        </Tooltip>
      )}
    </div>
    <div className={`font-mono text-sm font-semibold ${className || "text-foreground"}`}>{value}</div>
    {sub && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

const SwingTradingPanel = () => {
  const [enabled, setEnabled] = useState(true);
  const { data: signals, isLoading, error, refetch } = useSwingSignals(enabled);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    clearSwingCache();
    await queryClient.invalidateQueries({ queryKey: ["swing-signals"] });
    setEnabled(true);
    await refetch();
    setRefreshing(false);
  };

  const fdaSignals = (signals ?? []).filter((s) => s.signal_type === "FDA_APPROVAL");
  const otherSignals = (signals ?? []).filter((s) => s.signal_type !== "FDA_APPROVAL");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm text-muted-foreground inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Short-Term Swing Signals — FDA Approvals & Catalysts (1d–2w)
        </h3>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || isLoading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing || isLoading ? "animate-spin" : ""}`} />
          {refreshing || isLoading ? "Scanning…" : "Scan Signals"}
        </Button>
      </div>

      {isLoading && <div className="text-center text-muted-foreground py-20 font-mono text-sm">Scanning news for FDA approvals & swing catalysts…</div>}
      {error && <div className="text-center text-destructive py-20 font-mono text-sm">Failed to load signals.</div>}

      {!isLoading && signals && signals.length === 0 && (
        <div className="text-center text-muted-foreground py-20 font-mono text-sm">No signals found right now.</div>
      )}

      {fdaSignals.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-serif text-xs text-pine uppercase tracking-widest flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> FDA Approvals — Highest Priority
          </h4>
          <div className="space-y-3">{fdaSignals.map((s, i) => <SignalCard key={`fda-${i}`} s={s} />)}</div>
        </div>
      )}

      {otherSignals.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-serif text-xs text-muted-foreground uppercase tracking-widest">Other Swing Catalysts</h4>
          <div className="space-y-3">{otherSignals.map((s, i) => <SignalCard key={`o-${i}`} s={s} />)}</div>
        </div>
      )}
    </div>
  );
};

export default SwingTradingPanel;
