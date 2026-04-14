import { useState } from "react";
import { Link } from "react-router-dom";
import { sectors, StockQuote, formatCurrency } from "@/data/stocks";
import { useStockData } from "@/hooks/useStockData";
import { usePriceEvaluations, PriceEvaluation, clearPriceCache } from "@/hooks/usePriceEvaluations";
import DashboardHeader from "@/components/DashboardHeader";
import NewsPanel from "@/components/NewsPanel";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

const Index = () => {
  const queryClient = useQueryClient();
  const { data: quotes, isLoading, error } = useStockData();
  const { data: evaluations, isLoading: evalLoading } = usePriceEvaluations(quotes);
  const [collapsedSectors, setCollapsedSectors] = useState<Set<string>>(new Set());

  const quoteMap = new Map<string, StockQuote>();
  quotes?.forEach((q) => quoteMap.set(q.ticker, q));

  const evalMap = new Map<string, PriceEvaluation>();
  evaluations?.forEach((e) => evalMap.set(e.ticker, e));

  const handleRefresh = () => {
    clearPriceCache();
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto bg-card border-x border-border shadow-2xl min-h-screen">
        <DashboardHeader
          totalStocks={sectors.flatMap(s => s.tickers).length}
          onRefresh={handleRefresh}
          onManageStocks={() => {}}
          isRefreshing={evalLoading}
        />

        <div className="px-4 md:px-8 pt-4">
          <Tabs defaultValue="portfolio">
            <TabsList className="mb-4">
              <TabsTrigger value="portfolio" className="text-xs font-mono">Portfolio</TabsTrigger>
              <TabsTrigger value="announcements" className="text-xs font-mono">Weekly Announcements</TabsTrigger>
            </TabsList>

            <TabsContent value="portfolio">
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

                {!isLoading && !error && sectors.map((sector) => {
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
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground h-8">Symbol</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right h-8">Price</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-primary text-right h-8">Buy</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right h-8">Hold</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-destructive text-right h-8">Sell</TableHead>
                                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center h-8 w-14"></TableHead>
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
                                      <span className="font-mono text-sm text-primary tabular-nums">
                                        {evalLoading ? "…" : ev ? formatCurrency(ev.buyPrice) : "—"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-right">
                                      <span className="font-mono text-sm text-muted-foreground tabular-nums">
                                        {evalLoading ? "…" : ev ? formatCurrency(ev.holdPrice) : "—"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="py-2 px-4 text-right">
                                      <span className="font-mono text-sm text-destructive tabular-nums">
                                        {evalLoading ? "…" : ev ? formatCurrency(ev.salePrice) : "—"}
                                      </span>
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

            <TabsContent value="announcements">
              <div className="pb-8">
                <NewsPanel />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;
