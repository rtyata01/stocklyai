import { useState } from "react";
import { useStockNews, useRefreshNews } from "@/hooks/useStockNews";
import { RefreshCw, TrendingUp, Target, ShieldAlert, Zap, CalendarDays, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

interface EarningsPick {
  earnings_date: string;
  consensus_eps: number;
  expected_eps: number;
  beat_confidence: string;
  entry_price: number;
  price_target: number;
  stop_loss: number;
  risk_reward_ratio: string;
  thesis: string;
  catalysts: string[];
  risks: string[];
  next_quarter_growth: string;
}

const NewsPanel = () => {
  const { data: news, isLoading } = useStockNews();
  const refreshNews = useRefreshNews();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const item = news?.[0];
  let pick: EarningsPick | null = null;
  if (item?.summary) {
    try {
      pick = JSON.parse(item.summary);
    } catch { /* fallback */ }
  }

  const confidenceColor = (c: string) => {
    if (c === "High") return "text-pine";
    if (c === "Medium") return "text-yellow-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm text-muted-foreground">
          Top Earnings Momentum Pick — Next 2-3 Weeks
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Analyzing…" : "Find Best Pick"}
        </Button>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-20 font-mono text-sm">
          Loading…
        </div>
      )}

      {!isLoading && !item && (
        <div className="text-center text-muted-foreground py-20 font-mono text-sm">
          No pick available. Click "Find Best Pick" to run AI analysis.
        </div>
      )}

      {!isLoading && item && pick && (
        <div className="border border-primary/40 rounded-sm bg-primary/5 overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-primary/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-primary text-primary-foreground font-mono text-sm px-3 py-1">
                    {item.ticker}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] font-mono ${confidenceColor(pick.beat_confidence)}`}>
                    {pick.beat_confidence} Confidence
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    R:R {pick.risk_reward_ratio}
                  </Badge>
                </div>
                <h2 className="font-serif text-lg font-semibold text-foreground leading-tight">
                  {item.headline}
                </h2>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono shrink-0">
                <CalendarDays className="h-3.5 w-3.5" />
                Earnings: {pick.earnings_date}
              </div>
            </div>
          </div>

          {/* Trade Setup */}
          <div className="grid grid-cols-3 border-b border-primary/20">
            <div className="p-4 text-center border-r border-primary/20">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Entry</div>
              <div className="font-mono text-base font-semibold text-foreground">${pick.entry_price.toFixed(2)}</div>
            </div>
            <div className="p-4 text-center border-r border-primary/20">
              <div className="text-[10px] font-mono text-primary uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> Target
              </div>
              <div className="font-mono text-base font-semibold text-primary">${pick.price_target.toFixed(2)}</div>
            </div>
            <div className="p-4 text-center">
              <div className="text-[10px] font-mono text-destructive uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                <ArrowDownRight className="h-3 w-3" /> Stop Loss
              </div>
              <div className="font-mono text-base font-semibold text-destructive">${pick.stop_loss.toFixed(2)}</div>
            </div>
          </div>

          {/* EPS */}
          <div className="grid grid-cols-2 border-b border-primary/20">
            <div className="p-4 border-r border-primary/20">
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Consensus EPS</div>
              <div className="font-mono text-sm text-foreground">${pick.consensus_eps.toFixed(2)}</div>
            </div>
            <div className="p-4">
              <div className="text-[10px] font-mono text-pine uppercase tracking-widest mb-1">Expected EPS (Whisper)</div>
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
                    <span className="text-primary mt-0.5">•</span>
                    {c}
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
                    <span className="text-destructive mt-0.5">•</span>
                    {r}
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
      )}

      {/* Fallback if summary isn't structured */}
      {!isLoading && item && !pick && (
        <div className="border rounded-sm p-4 border-border bg-card">
          <Badge variant="outline" className="font-mono text-[10px] mb-2">{item.ticker}</Badge>
          <h3 className="font-serif text-sm font-medium text-foreground">{item.headline}</h3>
          {item.summary && <p className="text-xs text-muted-foreground mt-1">{item.summary}</p>}
        </div>
      )}
    </div>
  );
};

export default NewsPanel;
