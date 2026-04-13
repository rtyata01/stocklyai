import { sectors, StockQuote } from "@/data/stocks";
import { useStockData } from "@/hooks/useStockData";
import StockTile from "@/components/StockTile";
import DashboardHeader from "@/components/DashboardHeader";

const Index = () => {
  const { data: quotes, isLoading, error } = useStockData();

  const quoteMap = new Map<string, StockQuote>();
  quotes?.forEach((q) => quoteMap.set(q.ticker, q));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto bg-card border-x border-border shadow-2xl min-h-screen">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[100px] pointer-events-none rounded-full" />

        <DashboardHeader totalStocks={sectors.flatMap(s => s.tickers).length} />

        <main className="p-6 md:p-10 relative z-10 space-y-8">
          {isLoading && (
            <div className="text-center text-muted-foreground py-20 font-mono text-sm">
              Fetching market data…
            </div>
          )}

          {error && (
            <div className="text-center text-rust py-20 font-mono text-sm">
              Failed to load data. Retrying…
            </div>
          )}

          {!isLoading && !error && sectors.map((sector) => (
            <section key={sector.name}>
              <h2 className="font-serif text-lg text-foreground mb-4 flex items-center gap-3">
                {sector.name}
                <span className="flex-1 h-[1px] bg-border" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  {sector.tickers.length} assets
                </span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {sector.tickers.map((ticker) => {
                  const quote = quoteMap.get(ticker) || {
                    ticker, price: 0, dayMin: 0, dayMax: 0, peRatio: null, change: 0
                  };
                  return <StockTile key={ticker} quote={quote} />;
                })}
              </div>
            </section>
          ))}
        </main>
      </div>
    </div>
  );
};

export default Index;
