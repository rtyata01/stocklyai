import { Stock, formatCurrency, formatPercent, getSignal } from "@/data/stocks";
import { useNavigate } from "react-router-dom";

interface StockCardProps {
  stock: Stock;
}

const StockCard = ({ stock }: StockCardProps) => {
  const navigate = useNavigate();
  const signal = getSignal(stock);
  const isPositive = stock.change >= 0;

  const priceRange = stock.dayMax - stock.dayMin;
  const pricePosition = priceRange > 0
    ? ((stock.currentPrice - stock.dayMin) / priceRange) * 100
    : 50;

  return (
    <div
      className="group relative bg-card border border-border rounded-sm p-6 cursor-pointer transition-all duration-300 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col min-h-[220px]"
      onClick={() => navigate(`/stock/${stock.ticker}`)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-wide text-foreground">
            {stock.ticker}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{stock.name}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl text-foreground tabular-nums">
            {stock.currentPrice.toFixed(2)}
          </div>
          <div className={`text-[10px] font-mono mt-1 ${isPositive ? "text-pine" : "text-rust"}`}>
            {formatPercent(stock.change)}
          </div>
        </div>
      </div>

      {/* Price Bar */}
      <div className="mt-auto relative">
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground tracking-widest mb-2 uppercase">
          <span>Day Min</span>
          <span>Day Max</span>
        </div>
        <div className="h-1 w-full bg-background overflow-hidden rounded-full">
          <div className="h-full bg-border w-[70%] ml-[15%] relative">
            <div
              className="absolute top-0 w-[2px] h-full bg-primary shadow-[0_0_4px_hsl(var(--primary))]"
              style={{ left: `${pricePosition}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs font-mono text-foreground mt-2 tabular-nums">
          <span>{stock.dayMin.toFixed(2)}</span>
          <span>{stock.dayMax.toFixed(2)}</span>
        </div>
      </div>

      {/* Hover Tooltip */}
      <div className="absolute bottom-0 left-0 w-full bg-background/[0.98] backdrop-blur-md border-t border-primary/30 p-5 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-[400ms] ease-[cubic-bezier(0.23,1,0.32,1)] z-20">
        <div className="text-[10px] uppercase font-sans tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <span className="w-2 h-[1px] bg-primary/50" />
          Action Thresholds
          <span className="flex-1 h-[1px] bg-primary/20" />
        </div>
        <div className="grid grid-cols-3 gap-2 font-mono text-xs tabular-nums">
          <div className={`flex flex-col ${signal === "buy" ? "text-pine font-semibold" : ""}`}>
            <span className="text-pine mb-1">BUY</span>
            <span className="text-foreground">&lt; {formatCurrency(stock.valuation.buy)}</span>
          </div>
          <div className={`flex flex-col border-l border-r border-border px-2 text-center ${signal === "hold" ? "text-primary font-semibold" : ""}`}>
            <span className="text-muted-foreground mb-1">HOLD</span>
            <span className="text-foreground">
              {formatCurrency(stock.valuation.hold[0])} - {formatCurrency(stock.valuation.hold[1])}
            </span>
          </div>
          <div className={`flex flex-col text-right ${signal === "sell" ? "text-rust font-semibold" : ""}`}>
            <span className="text-rust mb-1">SELL</span>
            <span className="text-foreground">&gt; {formatCurrency(stock.valuation.sell)}</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground uppercase tracking-wider text-center">
          Current signal: <span className={
            signal === "buy" ? "text-pine" : signal === "sell" ? "text-rust" : "text-primary"
          }>{signal.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};

export default StockCard;
