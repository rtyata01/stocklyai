import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { stocks, formatCurrency, formatPercent, getSignal, simulateInvestment } from "@/data/stocks";
import EarningsChart from "@/components/EarningsChart";
import InvestmentSimulation from "@/components/InvestmentSimulation";

const StockDetail = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const [earningsView, setEarningsView] = useState<"quarterly" | "yearly">("quarterly");

  const stock = stocks.find((s) => s.ticker === ticker);

  if (!stock) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground font-mono">Stock not found.</p>
          <button onClick={() => navigate("/")} className="text-primary font-mono text-sm mt-4 underline">
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  const signal = getSignal(stock);
  const sim = simulateInvestment(stock);
  const isPositive = stock.change >= 0;
  const earningsData = earningsView === "quarterly" ? stock.quarterlyEarnings : stock.yearlyEarnings;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto bg-card border-x border-border shadow-2xl min-h-screen">
        {/* Back nav */}
        <div className="px-6 md:px-10 pt-6 pb-4 border-b border-border">
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground font-mono text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Stock Header */}
        <header className="px-6 md:px-10 py-8 border-b border-border bg-gradient-to-b from-secondary/30 to-transparent">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-6">
            <div>
              <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-1">
                {stock.sector}
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-foreground">
                {stock.ticker}
              </h1>
              <p className="text-muted-foreground mt-1">{stock.name}</p>
            </div>
            <div className="md:text-right">
              <div className="font-mono text-3xl md:text-4xl text-foreground tabular-nums">
                {formatCurrency(stock.currentPrice)}
              </div>
              <div className={`font-mono text-sm mt-1 ${isPositive ? "text-pine" : "text-rust"}`}>
                {formatPercent(stock.change)} today
              </div>
            </div>
          </div>

          {/* Valuation Ranges */}
          <div className="mt-8 grid grid-cols-3 gap-3 font-mono text-sm">
            <div className={`p-4 border rounded-sm ${signal === "buy" ? "border-pine/40 bg-pine/10" : "border-border bg-secondary/50"}`}>
              <div className="text-pine text-xs uppercase tracking-widest mb-2">Buy Zone</div>
              <div className="text-foreground tabular-nums">&lt; {formatCurrency(stock.valuation.buy)}</div>
            </div>
            <div className={`p-4 border rounded-sm ${signal === "hold" ? "border-primary/40 bg-primary/10" : "border-border bg-secondary/50"}`}>
              <div className="text-primary text-xs uppercase tracking-widest mb-2">Hold Zone</div>
              <div className="text-foreground tabular-nums">
                {formatCurrency(stock.valuation.hold[0])} – {formatCurrency(stock.valuation.hold[1])}
              </div>
            </div>
            <div className={`p-4 border rounded-sm ${signal === "sell" ? "border-rust/40 bg-rust/10" : "border-border bg-secondary/50"}`}>
              <div className="text-rust text-xs uppercase tracking-widest mb-2">Sell Zone</div>
              <div className="text-foreground tabular-nums">&gt; {formatCurrency(stock.valuation.sell)}</div>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10 space-y-10">
          {/* Earnings Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-xl text-foreground">Earnings Performance</h2>
              <div className="flex bg-background border border-border rounded-sm overflow-hidden">
                <button
                  onClick={() => setEarningsView("quarterly")}
                  className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                    earningsView === "quarterly"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Quarterly
                </button>
                <button
                  onClick={() => setEarningsView("yearly")}
                  className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                    earningsView === "yearly"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>
            <EarningsChart data={earningsData} />
          </section>

          {/* Investment Simulation */}
          <InvestmentSimulation stock={stock} />
        </div>
      </div>
    </div>
  );
};

export default StockDetail;
