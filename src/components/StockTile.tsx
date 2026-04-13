import { StockQuote, formatCurrency, formatPercent } from "@/data/stocks";

interface StockTileProps {
  quote: StockQuote;
}

const StockTile = ({ quote }: StockTileProps) => {
  const isPositive = quote.change >= 0;
  const noData = quote.price === 0;

  return (
    <div className="bg-card border border-border rounded-sm p-4 hover:border-primary/40 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-serif text-base font-medium text-foreground tracking-wide">
          {quote.ticker}
        </h3>
        <div className={`text-xs font-mono ${isPositive ? "text-pine" : "text-rust"}`}>
          {noData ? "—" : formatPercent(quote.change)}
        </div>
      </div>

      {noData ? (
        <div className="text-xs font-mono text-muted-foreground">No data</div>
      ) : (
        <div className="space-y-1.5 text-xs font-mono">
          <div className="flex justify-between text-muted-foreground">
            <span>Price</span>
            <span className="text-foreground tabular-nums">{formatCurrency(quote.price)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Day Min</span>
            <span className="text-foreground tabular-nums">{formatCurrency(quote.dayMin)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Day Max</span>
            <span className="text-foreground tabular-nums">{formatCurrency(quote.dayMax)}</span>
          </div>
          {quote.peRatio !== null && (
            <div className="flex justify-between text-muted-foreground">
              <span>PE Ratio</span>
              <span className="text-foreground tabular-nums">{quote.peRatio.toFixed(1)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StockTile;
