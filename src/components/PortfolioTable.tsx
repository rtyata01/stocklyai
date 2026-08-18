import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatVolume, SectorGroup } from "@/data/stocks";
import { useStockData } from "@/hooks/useStockData";
import { usePriceEvaluations, clearPriceCache } from "@/hooks/usePriceEvaluations";
import { useStockInsights } from "@/hooks/useStockInsights";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Crown, GripVertical, HelpCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const BUY_HELP = "BUY zone — aggregated entry price computed from: (1) analyst consensus & 52-week support, (2) intrinsic value from forward EPS × peer P/E, (3) PEG ratio < 1 signal, (4) margin-of-safety guardrail (typically 15–30% below fair value). Median of valid methods.";
const HOLD_HELP = "HOLD / fair value — center estimate close to current price using analyst consensus 12-month target, forward intrinsic value, and PEG ≈ 1 signal. Holding here implies risk/reward is balanced.";
const SELL_HELP = "SELL zone — aggregated upside exit computed from: (1) analyst price targets, (2) intrinsic value ceiling, (3) PEG > 1.5 / overvalued flag, (4) sentiment-adjusted stretch above last week's average.";
const VOLUME_HELP = "Today's traded share volume. High volume confirms breakouts; low volume on a move suggests weak conviction.";

type SortKey = "symbol" | "price" | "volume" | "buy" | "hold" | "sell";
type SortDir = "asc" | "desc";

interface Props {
  sectors: SectorGroup[];
  showRefresh?: boolean;
  toolbarExtras?: React.ReactNode;
  emptyMessage?: string;
  /** Encodes which tab to return to from the stock detail page. */
  viewFrom?: "portfolio" | "mylists";
  /** Extra async work triggered on Re-evaluate (e.g. breaking news scan). */
  onExtraRefresh?: () => void | Promise<void>;
  /** When provided, sector headers become drag handles for reordering. */
  onReorderSectors?: (sectors: SectorGroup[]) => void;
}

export default function PortfolioTable({
  sectors,
  showRefresh = true,
  toolbarExtras,
  emptyMessage,
  viewFrom = "portfolio",
  onExtraRefresh,
  onReorderSectors,
}: Props) {
  const queryClient = useQueryClient();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const allTickers = sectors.flatMap((s) => s.tickers);
  const { data: quotes, isLoading, error } = useStockData(refreshNonce, allTickers);
  const { data: evaluations, isLoading: evalLoading } = usePriceEvaluations(quotes, refreshNonce);
  const { data: insights } = useStockInsights(quotes, refreshNonce);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [dragName, setDragName] = useState<string | null>(null);
  const [dropName, setDropName] = useState<string | null>(null);

  const reorderable = typeof onReorderSectors === "function";

  const handleDrop = (targetName: string) => {
    setDropName(null);
    const source = dragName;
    setDragName(null);
    if (!reorderable || !source || source === targetName) return;
    const next = [...sectors];
    const from = next.findIndex((s) => s.name === source);
    const to = next.findIndex((s) => s.name === targetName);
    if (from === -1 || to === -1) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorderSectors!(next);
  };

  const moveSector = (name: string, delta: number) => {
    if (!reorderable) return;
    const next = [...sectors];
    const from = next.findIndex((s) => s.name === name);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= next.length) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorderSectors!(next);
  };

  const quoteMap = new Map(quotes?.map((q) => [q.ticker, q]) ?? []);
  const evalMap = new Map(evaluations?.map((e) => [e.ticker, e]) ?? []);
  const insightMap = new Map(insights?.map((i) => [i.ticker, i]) ?? []);

  const handleRefresh = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("price-evaluations:") || k.startsWith("stock-quotes:") || k.startsWith("stock-insights:"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    clearPriceCache();
    setRefreshNonce((n) => n + 1);
    queryClient.invalidateQueries({ queryKey: ["stock-quotes"] });
    queryClient.invalidateQueries({ queryKey: ["price-evaluations"] });
    queryClient.invalidateQueries({ queryKey: ["stock-insights"] });
    if (onExtraRefresh) { void onExtraRefresh(); }
  };

  const toggle = (name: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const getSortValue = (ticker: string, key: SortKey): number | string => {
    const q = quoteMap.get(ticker);
    const ev = evalMap.get(ticker);
    switch (key) {
      case "symbol": return ticker;
      case "price": return q?.price ?? -Infinity;
      case "volume": return q?.volume ?? -Infinity;
      case "buy": return ev?.buyPrice ?? -Infinity;
      case "hold": return ev?.holdPrice ?? -Infinity;
      case "sell": return ev?.salePrice ?? -Infinity;
    }
  };

  const sortedSectors = useMemo(() => {
    if (!sort) return sectors;
    return sectors.map((s) => {
      const tickers = [...s.tickers].sort((a, b) => {
        const av = getSortValue(a, sort.key);
        const bv = getSortValue(b, sort.key);
        let cmp: number;
        if (typeof av === "string" || typeof bv === "string") {
          cmp = String(av).localeCompare(String(bv));
        } else {
          cmp = (av as number) - (bv as number);
        }
        return sort.dir === "asc" ? cmp : -cmp;
      });
      return { ...s, tickers };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, sort, quotes, evaluations]);

  const hasAny = allTickers.length > 0;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sort?.key !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const headerBtnCls = "inline-flex items-center gap-1 hover:text-foreground transition-colors";

  return (
    <div>
      {(showRefresh || toolbarExtras) && (
        <div className="flex flex-wrap justify-end items-center gap-2 mb-3">
          {toolbarExtras}
          {showRefresh && (
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={!hasAny || evalLoading || isLoading} className="gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${(evalLoading || isLoading) ? "animate-spin" : ""}`} />
              Re-evaluate
            </Button>
          )}
        </div>
      )}

      <div className="space-y-4 pb-8">
        {!hasAny && (
          <div className="text-center text-muted-foreground py-16 font-mono text-sm">
            {emptyMessage ?? "No stocks yet."}
          </div>
        )}

        {hasAny && isLoading && (
          <div className="text-center text-muted-foreground py-20 font-mono text-sm">Fetching market data…</div>
        )}
        {hasAny && error && (
          <div className="text-center text-destructive py-20 font-mono text-sm">Failed to load data. Retrying…</div>
        )}

        {hasAny && !isLoading && !error && sortedSectors.map((sector, sectorIdx) => {
          const isOpen = !collapsed.has(sector.name);
          return (
            <Collapsible key={sector.name} open={isOpen} onOpenChange={() => toggle(sector.name)}>
              <div
                draggable={reorderable}
                onDragStart={() => setDragName(sector.name)}
                onDragEnd={() => { setDragName(null); setDropName(null); }}
                onDragOver={(e) => { if (reorderable && dragName) { e.preventDefault(); setDropName(sector.name); } }}
                onDragLeave={() => setDropName((n) => (n === sector.name ? null : n))}
                onDrop={(e) => { e.preventDefault(); handleDrop(sector.name); }}
                className={`flex items-center gap-2 mb-2 rounded-sm transition-colors ${
                  dropName === sector.name && dragName !== sector.name ? "bg-primary/10 ring-1 ring-primary/40" : ""
                } ${dragName === sector.name ? "opacity-50" : ""}`}
              >
                {reorderable && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                          aria-label={`Drag to reorder ${sector.name}`}
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">Drag to reorder sectors</TooltipContent>
                    </Tooltip>
                    <button
                      type="button"
                      onClick={() => moveSector(sector.name, -1)}
                      disabled={sectorIdx === 0}
                      aria-label={`Move ${sector.name} up`}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSector(sector.name, 1)}
                      disabled={sectorIdx === sortedSectors.length - 1}
                      aria-label={`Move ${sector.name} down`}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <CollapsibleTrigger className="flex-1 min-w-0">
                  <h2 className="font-serif text-base text-foreground flex items-center gap-3 cursor-pointer hover:text-primary transition-colors group">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    {sector.name}
                    <span className="flex-1 h-[1px] bg-border" />
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      {sector.tickers.length} assets
                    </span>
                  </h2>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="border border-border rounded-sm overflow-hidden">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                        <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground h-8 w-[16%]">
                          <button type="button" onClick={() => toggleSort("symbol")} className={headerBtnCls}>
                            Symbol <SortIcon col="symbol" />
                          </button>
                        </TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right h-8 w-[14%]">
                          <button type="button" onClick={() => toggleSort("price")} className={`${headerBtnCls} w-full justify-end`}>
                            Price <SortIcon col="price" />
                          </button>
                        </TableHead>
                        <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right h-8 w-[16%]">
                          <span className="inline-flex items-center justify-end gap-1">
                            <button type="button" onClick={() => toggleSort("volume")} className={headerBtnCls}>
                              Volume <SortIcon col="volume" />
                            </button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" aria-label="About Volume column" className="text-muted-foreground/60 hover:text-foreground"><HelpCircle className="h-3 w-3" /></button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{VOLUME_HELP}</TooltipContent>
                            </Tooltip>
                          </span>
                        </TableHead>
                        <TableHead className="hidden md:table-cell font-mono text-[10px] uppercase tracking-widest text-primary text-right h-8 w-[14%]">
                          <span className="inline-flex items-center justify-end gap-1">
                            <button type="button" onClick={() => toggleSort("buy")} className={`${headerBtnCls} text-primary`}>
                              Buy <SortIcon col="buy" />
                            </button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" aria-label="About Buy zone" className="text-primary/60 hover:text-primary"><HelpCircle className="h-3 w-3" /></button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{BUY_HELP}</TooltipContent>
                            </Tooltip>
                          </span>
                        </TableHead>
                        <TableHead className="hidden md:table-cell font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right h-8 w-[14%]">
                          <span className="inline-flex items-center justify-end gap-1">
                            <button type="button" onClick={() => toggleSort("hold")} className={headerBtnCls}>
                              Hold <SortIcon col="hold" />
                            </button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" aria-label="About Hold zone" className="text-muted-foreground/60 hover:text-foreground"><HelpCircle className="h-3 w-3" /></button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{HOLD_HELP}</TooltipContent>
                            </Tooltip>
                          </span>
                        </TableHead>
                        <TableHead className="hidden md:table-cell font-mono text-[10px] uppercase tracking-widest text-destructive text-right h-8 w-[14%]">
                          <span className="inline-flex items-center justify-end gap-1">
                            <button type="button" onClick={() => toggleSort("sell")} className={`${headerBtnCls} text-destructive`}>
                              Sell <SortIcon col="sell" />
                            </button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" aria-label="About Sell zone" className="text-destructive/60 hover:text-destructive"><HelpCircle className="h-3 w-3" /></button>
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
                        const insight = insightMap.get(ticker);
                        const price = quote?.price ?? 0;
                        const noData = price === 0;
                        const change = quote?.change ?? 0;
                        const isPositive = change >= 0;
                        return (
                          <TableRow key={ticker} className="hover:bg-secondary/30 border-border">
                            <TableCell className="py-2 px-4">
                              <div className="flex items-center gap-2">
                                {insight?.isKing && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex shrink-0 cursor-help" aria-label="Category king">
                                        <Crown className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                                      <strong className="text-amber-500">Category King</strong>
                                      <div className="mt-1">{insight.dominanceReason}</div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
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
                                {quote?.volumeChange !== undefined && Number.isFinite(quote.volumeChange) && (
                                  <span className={`text-[10px] font-mono ${quote.volumeChange >= 0 ? "text-pine" : "text-destructive"}`}>
                                    {quote.volumeChange >= 0 ? "+" : ""}{quote.volumeChange.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell py-2 px-4 text-right">
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
                            <TableCell className="hidden md:table-cell py-2 px-4 text-right">
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
                            <TableCell className="hidden md:table-cell py-2 px-4 text-right">
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
                                to={`/stock/${ticker}?from=${viewFrom}`}
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

        {hasAny && evalLoading && !isLoading && (
          <div className="text-center text-muted-foreground py-4 font-mono text-xs">
            AI is evaluating fair prices…
          </div>
        )}
      </div>
    </div>
  );
}
