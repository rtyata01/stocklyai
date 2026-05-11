import { useState } from "react";
import { useStockNews, useRefreshNews } from "@/hooks/useStockNews";
import { useStockData } from "@/hooks/useStockData";
import { usePriceEvaluations } from "@/hooks/usePriceEvaluations";
import { RefreshCw, TrendingUp, ShieldAlert, Zap, CalendarDays, DollarSign, ArrowUpRight, ArrowDownRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";

interface EarningsPick {
  rank: number;
  earnings_date: string;
  consensus_eps: number;
  expected_eps: number;
  beat_confidence: string;
  current_price?: number;
  entry_price: number;
  price_target: number;
  stop_loss: number;
  risk_reward_ratio: string;
  thesis: string;
  catalysts: string[];
  risks: string[];
  next_quarter_growth: string;
}

interface ParsedPick {
  ticker: string;
  headline: string;
  pick: EarningsPick;
}

const confidenceColor = (c: string) => {
  if (c === "High") return "text-pine";
  if (c === "Medium") return "text-yellow-500";
  return "text-destructive";
};

const HelpTip = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="inline-flex text-muted-foreground hover:text-foreground transition-colors" aria-label="How is this calculated?">
        <HelpCircle className="h-3 w-3" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
      {text}
    </TooltipContent>
  </Tooltip>
);

const PickCard = ({ ticker, headline, pick, livePrice, ev }: ParsedPick & { livePrice?: number; ev?: { buyPrice: number; holdPrice: number; salePrice: number; reasoning?: string } }) => {
  const current = livePrice && livePrice > 0 ? livePrice : pick.current_price ?? 0;
  // Align entry/target/stop with BUY/HOLD/SELL framework when AI evaluation is available
  const entry = ev ? ev.buyPrice : pick.entry_price;
  const target = ev ? ev.salePrice : pick.price_target;
  const stop = ev ? +(ev.buyPrice * 0.93).toFixed(2) : pick.stop_loss;
  const evalNote = ev?.reasoning ? ` Aligned with portfolio BUY/HOLD/SELL evaluation: ${ev.reasoning}` : "";

  return (
  <div className="border border-primary/40 rounded-sm bg-primary/5 overflow-hidden">
    {/* Header */}
    <div className="p-5 border-b border-primary/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className="bg-primary text-primary-foreground font-mono text-sm px-3 py-1">{ticker}</Badge>
            <Badge variant="outline" className={`text-[10px] font-mono ${confidenceColor(pick.beat_confidence)}`}>
              {pick.beat_confidence} Confidence
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono inline-flex items-center gap-1">
              Risk:Reward {pick.risk_reward_ratio}
              <HelpTip text="Risk:Reward = (Target − Entry) ÷ (Entry − Stop Loss). A value of 1:2 means potential upside is at least 2× the downside risk." />
            </Badge>
          </div>
          <h2 className="font-serif text-lg font-semibold text-foreground leading-tight">{headline}</h2>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono shrink-0">
          <CalendarDays className="h-3.5 w-3.5" />
          Earnings: {pick.earnings_date}
        </div>
      </div>
    </div>

    {/* Trade Setup — aligned with BUY / HOLD / SELL framework */}
    <div className="grid grid-cols-4 border-b border-primary/20">
      <div className="p-4 text-center border-r border-primary/20">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
          Current
          <HelpTip text="Live market price pulled from Yahoo Finance / Alpha Vantage in real time. All entry/target/stop levels are anchored to this price." />
        </div>
        <div className="font-mono text-base font-semibold text-foreground">
          {current > 0 ? `$${current.toFixed(2)}` : "—"}
        </div>
      </div>
      <div className="p-4 text-center border-r border-primary/20">
        <div className="text-[10px] font-mono text-pine uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
          Entry · BUY
          <HelpTip text={`BUY zone — aggregated entry from analyst consensus, intrinsic value (forward EPS × peer P/E), PEG < 1 signal, and 15–30% margin-of-safety guardrail. Same logic as the Portfolio BUY column.${evalNote}`} />
        </div>
        <div className="font-mono text-base font-semibold text-pine">${entry.toFixed(2)}</div>
      </div>
      <div className="p-4 text-center border-r border-primary/20">
        <div className="text-[10px] font-mono text-primary uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
          <ArrowUpRight className="h-3 w-3" /> Target · SELL
          <HelpTip text={`SELL zone — aggregated upside from analyst targets, intrinsic value ceiling, PEG > 1.5 flag, and sentiment-adjusted stretch (10–30% above fair value). Same logic as the Portfolio SELL column.${evalNote}`} />
        </div>
        <div className="font-mono text-base font-semibold text-primary">${target.toFixed(2)}</div>
      </div>
      <div className="p-4 text-center">
        <div className="text-[10px] font-mono text-destructive uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
          <ArrowDownRight className="h-3 w-3" /> Stop Loss
          <HelpTip text="Maximum downside before exiting — set ~7% below the BUY entry to cap losses if the earnings thesis fails." />
        </div>
        <div className="font-mono text-base font-semibold text-destructive">${stop.toFixed(2)}</div>
      </div>
    </div>


    {/* EPS */}
    <div className="grid grid-cols-2 border-b border-primary/20">
      <div className="p-4 border-r border-primary/20">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
          Consensus EPS
          <HelpTip text="Wall Street analyst average EPS estimate for the upcoming quarter." />
        </div>
        <div className="font-mono text-sm text-foreground">${pick.consensus_eps.toFixed(2)}</div>
      </div>
      <div className="p-4">
        <div className="text-[10px] font-mono text-pine uppercase tracking-widest mb-1 flex items-center gap-1">
          Expected EPS (Whisper)
          <HelpTip text="Whisper number — the unofficial 'real' EPS expectation derived from buy-side trader sentiment, recent guidance raises, and sector tailwinds. Beating this drives momentum." />
        </div>
        <div className="font-mono text-sm text-pine">${pick.expected_eps.toFixed(2)}</div>
      </div>
    </div>

    {/* Thesis */}
    <div className="p-5 border-b border-primary/20">
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Bull Thesis</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{pick.thesis}</p>
    </div>

    {/* Catalysts & Risks */}
    <div className="grid grid-cols-2">
      <div className="p-5 border-r border-primary/20">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Catalysts</span>
        </div>
        <ul className="space-y-1.5">
          {pick.catalysts.map((c, i) => (
            <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>{c}
            </li>
          ))}
        </ul>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-1.5 mb-2">
          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
          <span className="text-[10px] font-mono text-destructive uppercase tracking-widest">Risks</span>
        </div>
        <ul className="space-y-1.5">
          {pick.risks.map((r, i) => (
            <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
              <span className="text-destructive mt-0.5">•</span>{r}
            </li>
          ))}
        </ul>
      </div>
    </div>

    {/* Next Quarter */}
    <div className="p-5 border-t border-primary/20 bg-primary/10">
      <div className="flex items-center gap-1.5 mb-1">
        <DollarSign className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-mono text-primary uppercase tracking-widest">Next Quarter Outlook</span>
      </div>
      <p className="text-xs text-foreground">{pick.next_quarter_growth}</p>
    </div>
  </div>
  );
};

const NewsPanel = () => {
  const { data: news, isLoading } = useStockNews();
  const { data: quotes } = useStockData();
  const { data: evaluations } = usePriceEvaluations(quotes);
  const refreshNews = useRefreshNews();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const quoteMap = new Map((quotes ?? []).map(q => [q.ticker, q]));
  const evalMap = new Map((evaluations ?? []).map(e => [e.ticker, e]));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNews();
      await queryClient.invalidateQueries({ queryKey: ["stock-news"] });
    } catch (e) {
      console.error("Failed to refresh:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Parse all picks
  const picks: ParsedPick[] = (news ?? []).map(item => {
    try {
      const parsed = JSON.parse(item.summary ?? "");
      return { ticker: item.ticker, headline: item.headline, pick: parsed };
    } catch {
      return null;
    }
  }).filter(Boolean) as ParsedPick[];

  // Sort by rank
  picks.sort((a, b) => (a.pick.rank ?? 99) - (b.pick.rank ?? 99));

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm text-muted-foreground inline-flex items-center gap-1.5">
          Top Earnings Momentum Picks — Next 2-3 Weeks (R:R ≥ 1:2)
          <HelpTip text="AI scans the watchlist for stocks reporting earnings in 2–3 weeks with: (1) high probability of beating EPS estimates, (2) strong next-quarter growth outlook, and (3) a risk-to-reward ratio of at least 1:2. Entry/Target/Stop levels are anchored to today's market price and follow the BUY / HOLD / SELL framework." />
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Analyzing…" : "Find Best Picks"}
        </Button>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-20 font-mono text-sm">Loading…</div>
      )}

      {!isLoading && picks.length === 0 && (
        <div className="text-center text-muted-foreground py-20 font-mono text-sm">
          No picks available. Click "Find Best Picks" to run AI analysis.
        </div>
      )}

      {!isLoading && picks.length === 1 && (
        <PickCard {...picks[0]} livePrice={quoteMap.get(picks[0].ticker)?.price} ev={evalMap.get(picks[0].ticker)} />
      )}

      {!isLoading && picks.length > 1 && (
        <Tabs defaultValue={picks[0].ticker}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            {picks.map((p, i) => (
              <TabsTrigger key={p.ticker} value={p.ticker} className="text-xs font-mono gap-1.5">
                <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                {p.ticker}
              </TabsTrigger>
            ))}
          </TabsList>
          {picks.map(p => (
            <TabsContent key={p.ticker} value={p.ticker}>
              <PickCard {...p} livePrice={quoteMap.get(p.ticker)?.price} ev={evalMap.get(p.ticker)} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
    </TooltipProvider>
  );
};

export default NewsPanel;
