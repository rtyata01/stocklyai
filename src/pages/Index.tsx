import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatVolume } from "@/data/stocks";
import { useStockData } from "@/hooks/useStockData";
import { usePriceEvaluations, PriceEvaluation, clearPriceCache } from "@/hooks/usePriceEvaluations";
import DashboardHeader from "@/components/DashboardHeader";
import NewsPanel from "@/components/NewsPanel";
import SwingTradingPanel from "@/components/SwingTradingPanel";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import InvestingBasicsPanel from "@/components/InvestingBasicsPanel";
import ManageWatchlistDialog, { getWatchlistSectors } from "@/components/ManageWatchlistDialog";
import { SectorGroup, StockQuote } from "@/data/stocks";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, HelpCircle, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const BUY_HELP = "BUY zone — aggregated entry price computed from: (1) analyst consensus & 52-week support, (2) intrinsic value from forward EPS × peer P/E, (3) PEG ratio < 1 signal, (4) margin-of-safety guardrail (typically 15–30% below fair value). Median of valid methods.";
const HOLD_HELP = "HOLD / fair value — center estimate close to current price using analyst consensus 12-month target, forward intrinsic value, and PEG ≈ 1 signal. Holding here implies risk/reward is balanced.";
const SELL_HELP = "SELL zone — aggregated upside exit computed from: (1) analyst price targets, (2) intrinsic value ceiling, (3) PEG > 1.5 / overvalued flag, (4) sentiment-adjusted stretch above last week's average (typically 10–30% above fair value).";
const VOLUME_HELP = "Today's traded share volume. High volume confirms breakouts; low volume on a move suggests weak conviction.";

const SHOW_WATCHLIST = import.meta.env.DEV;

const Index = () => {
  const queryClient = useQueryClient();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const { data: quotes, isLoading, error } = useStockData(refreshNonce);
  const { data: evaluations, isLoading: evalLoading } = usePriceEvaluations(quotes, refreshNonce);
  const [collapsedSectors, setCollapsedSectors] = useState<Set<string>>(new Set());
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [activeSectors, setActiveSectors] = useState<SectorGroup[]>(() => getWatchlistSectors());

  const quoteMap = new Map<string, StockQuote>();
  quotes?.forEach((q) => quoteMap.set(q.ticker, q));

  const evalMap = new Map<string, PriceEvaluation>();
  evaluations?.forEach((e) => evalMap.set(e.ticker, e));

  const handleRefresh = () => {
    // Clear all relevant local cache entries
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("price-evaluations:") || k.startsWith("stock-quotes:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    clearPriceCache();
    setRefreshNonce((n) => n + 1);
    queryClient.invalidateQueries({ queryKey: ["stock-quotes"] });
    queryClient.invalidateQueries({ queryKey: ["price-evaluations"] });
  };

  const toggleSector = (name: string) => {
    setCollapsedSectors(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleWatchlistSave = (newSectors: SectorGroup[]) => {
    setActiveSectors(newSectors);
    // Refresh data with new tickers
    queryClient.invalidateQueries({ queryKey: ["stock-data"] });
    queryClient.invalidateQueries({ queryKey: ["price-evaluations"] });
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto bg-card border-x border-border shadow-2xl min-h-screen">
        <DashboardHeader
          totalStocks={activeSectors.flatMap(s => s.tickers).length}
        />

        {SHOW_WATCHLIST && (
          <ManageWatchlistDialog
            open={watchlistOpen}
            onOpenChange={setWatchlistOpen}
            onSave={handleWatchlistSave}
          />
        )}

        <div className="px-4 md:px-8 pt-4">
          <Tabs defaultValue="portfolio">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="portfolio" className="text-xs font-mono">Portfolio</TabsTrigger>
              <TabsTrigger value="earnings" className="text-xs font-mono">Earnings Momentum</TabsTrigger>
              <TabsTrigger value="swing" className="text-xs font-mono">Swing Trading</TabsTrigger>
              <TabsTrigger value="announcements" className="text-xs font-mono">Announcements</TabsTrigger>
              <TabsTrigger value="basics" className="text-xs font-mono">Investing 101</TabsTrigger>
            </TabsList>

            <TabsContent value="portfolio">
              <div className="flex justify-end gap-2 mb-3">
                {SHOW_WATCHLIST && (
                  <Button variant="outline" size="sm" onClick={() => setWatchlistOpen(true)} className="gap-1.5 text-xs">
                    <Settings className="h-3.5 w-3.5" />
                    Manage Watchlist
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={evalLoading || isLoading} className="gap-1.5 text-xs">
                  <RefreshCw className={`h-3.5 w-3.5 ${(evalLoading || isLoading) ? "animate-spin" : ""}`} />
                  Re-evaluate
                </Button>
              </div>
              <div className="space-y-4 pb-8">
                {isLoading && (
                  <div className="text-center text-muted-foreground py-20 font-mono text-sm">
                    Fetching market data…
                  </div>
                )}

                {error && (
                  <div className="text-center text-destructive py-20 font-mono text-sm">
                    Failed to load data. Retrying…
                  </div>
                )}

                {!isLoading && !error && activeSectors.map((sector) => {
                  const isOpen = !collapsedSectors.has(sector.name);
                  return (
                    <Collapsible key={sector.name} open={isOpen} onOpenChange={() => toggleSector(sector.name)}>
                      <CollapsibleTrigger className="w-full">
                        <h2 className="font-serif text-base text-foreground mb-2 flex items-center gap-3 cursor-pointer hover:text-primary transition-colors group">
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                          {sector.name}
                          <span className="flex-1 h-[1px] bg-border" />
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                            {sector.tickers.length} assets
                          </span>
                        </h2>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border border-border rounded-sm overflow-hidden">
                          <Table className="table-fixed w-full">
                            <TableHeader>
                              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground h-8 w-[16%]">Symbol</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right h-8 w-[14%]">Price</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right h-8 w-[16%]">
                                  <span className="inline-flex items-center justify-end gap-1">
                                    Volume
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="text-muted-foreground/60 hover:text-foreground"><HelpCircle className="h-3 w-3" /></button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{VOLUME_HELP}</TooltipContent>
                                    </Tooltip>
                                  </span>
                                </TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-primary text-right h-8 w-[14%]">
                                  <span className="inline-flex items-center justify-end gap-1">
                                    Buy
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="text-primary/60 hover:text-primary"><HelpCircle className="h-3 w-3" /></button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{BUY_HELP}</TooltipContent>
                                    </Tooltip>
                                  </span>
                                </TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right h-8 w-[14%]">
                                  <span className="inline-flex items-center justify-end gap-1">
                                    Hold
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="text-muted-foreground/60 hover:text-foreground"><HelpCircle className="h-3 w-3" /></button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{HOLD_HELP}</TooltipContent>
                                    </Tooltip>
                                  </span>
                                </TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-destructive text-right h-8 w-[14%]">
                                  <span className="inline-flex items-center justify-end gap-1">
                                    Sell
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="text-destructive/60 hover:text-destructive"><HelpCircle className="h-3 w-3" /></button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{SELL_HELP}</TooltipContent>
                                    </Tooltip>
                                  </span>
                                </TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center h-8 w-[12%]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sector.tickers.map((ticker) => {
                                const quote = quoteMap.get(ticker);
                                const ev = evalMap.get(ticker);
                                const price = quote?.price ?? 0;
                                const noData = price === 0;
                                const change = quote?.change ?? 0;
                                const isPositive = change >= 0;

                                return (
                                  <TableRow key={ticker} className="hover:bg-secondary/30 border-border">
                                    <TableCell className="py-2 px-4">
                                      <div className="flex items-center gap-2">
                                        <span className="font-serif text-sm font-medium text-foreground">{ticker}</span>
                                        {!noData && (
                                          <span className={`text-[10px] font-mono ${isPositive ? "text-pine" : "text-destructive"}`}>
                                            {isPositive ? "+" : ""}{change.toFixed(2)}%
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-right">
                                      <span className="font-mono text-sm text-foreground tabular-nums">
                                        {noData ? "—" : formatCurrency(price)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="font-mono text-xs text-muted-foreground tabular-nums">
                                          {formatVolume(quote?.volume)}
                                        </span>
                                        {quote?.volumeChange !== undefined && quote.volumeChange !== 0 && (
                                          <span className={`text-[10px] font-mono ${quote.volumeChange >= 0 ? "text-pine" : "text-destructive"}`}>
                                            {quote.volumeChange >= 0 ? "+" : ""}{quote.volumeChange.toFixed(1)}%
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-right">
                                      {ev?.reasoning ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="font-mono text-sm text-primary tabular-nums cursor-help underline decoration-dotted decoration-primary/40 underline-offset-4">
                                              {evalLoading ? "…" : formatCurrency(ev.buyPrice)}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                                            <strong className="text-primary">Why ${ev.buyPrice.toFixed(2)}?</strong>
                                            <div className="mt-1">{ev.reasoning}</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <span className="font-mono text-sm text-primary tabular-nums">
                                          {evalLoading ? "…" : ev ? formatCurrency(ev.buyPrice) : "—"}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-right">
                                      {ev?.reasoning ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="font-mono text-sm text-muted-foreground tabular-nums cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                                              {evalLoading ? "…" : formatCurrency(ev.holdPrice)}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                                            <strong>Why ${ev.holdPrice.toFixed(2)}?</strong>
                                            <div className="mt-1">{ev.reasoning}</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <span className="font-mono text-sm text-muted-foreground tabular-nums">
                                          {evalLoading ? "…" : ev ? formatCurrency(ev.holdPrice) : "—"}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-right">
                                      {ev?.reasoning ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="font-mono text-sm text-destructive tabular-nums cursor-help underline decoration-dotted decoration-destructive/40 underline-offset-4">
                                              {evalLoading ? "…" : formatCurrency(ev.salePrice)}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                                            <strong className="text-destructive">Why ${ev.salePrice.toFixed(2)}?</strong>
                                            <div className="mt-1">{ev.reasoning}</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <span className="font-mono text-sm text-destructive tabular-nums">
                                          {evalLoading ? "…" : ev ? formatCurrency(ev.salePrice) : "—"}
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-center">
                                      <Link
                                        to={`/stock/${ticker}`}
                                        className="text-[11px] font-mono text-primary hover:text-primary/80 underline underline-offset-2"
                                      >
                                        View
                                      </Link>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}

                {evalLoading && !isLoading && (
                  <div className="text-center text-muted-foreground py-4 font-mono text-xs">
                    AI is evaluating fair prices…
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="earnings">
              <div className="pb-8">
                <NewsPanel />
              </div>
            </TabsContent>

            <TabsContent value="swing">
              <div className="pb-8">
                <SwingTradingPanel />
              </div>
            </TabsContent>

            <TabsContent value="announcements">
              <div className="pb-8">
                <AnnouncementsPanel />
              </div>
            </TabsContent>

            <TabsContent value="basics">
              <div className="pb-8">
                <InvestingBasicsPanel />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default Index;
