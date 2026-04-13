import { Link } from "react-router-dom";
import { sectors, StockQuote, formatCurrency } from "@/data/stocks";
import { useStockData } from "@/hooks/useStockData";
import { usePriceEvaluations, PriceEvaluation } from "@/hooks/usePriceEvaluations";
import DashboardHeader from "@/components/DashboardHeader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const Index = () => {
  const { data: quotes, isLoading, error } = useStockData();
  const { data: evaluations, isLoading: evalLoading } = usePriceEvaluations(quotes);

  const quoteMap = new Map<string, StockQuote>();
  quotes?.forEach((q) => quoteMap.set(q.ticker, q));

  const evalMap = new Map<string, PriceEvaluation>();
  evaluations?.forEach((e) => evalMap.set(e.ticker, e));

  const sectorMap = new Map<string, string>();
  sectors.forEach((s) => s.tickers.forEach((t) => sectorMap.set(t, s.name)));

  const allRows = sectors.flatMap((sector) =>
    sector.tickers.map((ticker) => ({
      ticker,
      sector: sector.name,
      quote: quoteMap.get(ticker),
      eval: evalMap.get(ticker),
    }))
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto bg-card border-x border-border shadow-2xl min-h-screen">
        <DashboardHeader totalStocks={allRows.length} />

        <main className="p-4 md:p-8 relative z-10">
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

          {!isLoading && !error && (
            <div className="border border-border rounded-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                    <TableHead className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Symbol</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Sector</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground text-right">Price</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-widest text-primary text-right">Buy</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground text-right">Hold</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-widest text-destructive text-right">Sell</TableHead>
                    <TableHead className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground text-center w-16">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRows.map(({ ticker, sector, quote, eval: ev }) => {
                    const price = quote?.price ?? 0;
                    const noData = price === 0;
                    const change = quote?.change ?? 0;
                    const isPositive = change >= 0;

                    return (
                      <TableRow key={ticker} className="hover:bg-secondary/30 border-border">
                        <TableCell className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-sm font-medium text-foreground">{ticker}</span>
                            {!noData && (
                              <span className={`text-[10px] font-mono ${isPositive ? "text-pine" : "text-destructive"}`}>
                                {isPositive ? "+" : ""}{change.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 px-4">
                          <span className="text-xs font-mono text-muted-foreground">{sector}</span>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-right">
                          <span className="font-mono text-sm text-foreground tabular-nums">
                            {noData ? "—" : formatCurrency(price)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-right">
                          <span className="font-mono text-sm text-primary tabular-nums">
                            {evalLoading ? "…" : ev ? formatCurrency(ev.buyPrice) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-right">
                          <span className="font-mono text-sm text-muted-foreground tabular-nums">
                            {evalLoading ? "…" : ev ? formatCurrency(ev.holdPrice) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-right">
                          <span className="font-mono text-sm text-destructive tabular-nums">
                            {evalLoading ? "…" : ev ? formatCurrency(ev.salePrice) : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 px-4 text-center">
                          <Link
                            to={`/stock/${ticker}`}
                            className="text-xs font-mono text-primary hover:text-primary/80 underline underline-offset-2"
                          >
                            Details
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {evalLoading && !isLoading && (
            <div className="text-center text-muted-foreground py-4 font-mono text-xs">
              AI is evaluating fair prices…
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
