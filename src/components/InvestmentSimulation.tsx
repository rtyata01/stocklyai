import { Stock, formatCurrency, formatPercent, simulateInvestment } from "@/data/stocks";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface InvestmentSimulationProps {
  stock: Stock;
}

const InvestmentSimulation = ({ stock }: InvestmentSimulationProps) => {
  const sim = simulateInvestment(stock);
  const isProfit = sim.profitLoss >= 0;

  // Build growth data from yearly earnings prices
  const chartData = stock.yearlyEarnings.map((e) => {
    const shares = 1000 / stock.simulationStartPrice;
    return {
      period: e.period,
      value: parseFloat((shares * e.price).toFixed(2)),
    };
  });

  return (
    <section>
      <h2 className="font-serif text-xl text-foreground mb-6">
        Investment Simulation
      </h2>

      <div className="bg-secondary/30 border border-border rounded-sm p-4 md:p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 bg-background border border-border rounded-sm">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
              Initial Investment
            </div>
            <div className="font-mono text-lg text-foreground tabular-nums">
              {formatCurrency(1000)}
            </div>
          </div>
          <div className="p-4 bg-background border border-border rounded-sm">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
              Shares Purchased
            </div>
            <div className="font-mono text-lg text-foreground tabular-nums">
              {sim.shares.toFixed(4)}
            </div>
          </div>
          <div className="p-4 bg-background border border-border rounded-sm">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
              Current Value
            </div>
            <div className="font-mono text-lg text-foreground tabular-nums">
              {formatCurrency(sim.currentValue)}
            </div>
          </div>
          <div className={`p-4 border rounded-sm ${isProfit ? "bg-pine/10 border-pine/30" : "bg-rust/10 border-rust/30"}`}>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-2">
              Profit / Loss
            </div>
            <div className={`font-mono text-lg tabular-nums ${isProfit ? "text-pine" : "text-rust"}`}>
              {formatCurrency(sim.profitLoss)} ({formatPercent(sim.profitLossPercent)})
            </div>
          </div>
        </div>

        {/* Growth Chart */}
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isProfit ? "hsl(134, 17%, 31%)" : "hsl(5, 50%, 40%)"} stopOpacity={0.4} />
                <stop offset="95%" stopColor={isProfit ? "hsl(134, 17%, 31%)" : "hsl(5, 50%, 40%)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(16, 10%, 23%)" />
            <XAxis
              dataKey="period"
              tick={{ fill: "hsl(35, 8%, 60%)", fontSize: 11, fontFamily: "JetBrains Mono" }}
              axisLine={{ stroke: "hsl(16, 10%, 23%)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(35, 8%, 60%)", fontSize: 11, fontFamily: "JetBrains Mono" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(220, 7%, 8%)",
                border: "1px solid hsl(16, 10%, 23%)",
                borderRadius: "2px",
                fontFamily: "JetBrains Mono",
                fontSize: 12,
              }}
              formatter={(value: number) => [formatCurrency(value), "Portfolio Value"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={isProfit ? "hsl(134, 17%, 31%)" : "hsl(5, 50%, 40%)"}
              strokeWidth={2}
              fill="url(#growthGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="mt-4 text-[10px] font-mono text-muted-foreground uppercase tracking-widest text-center">
          Simulated $1,000 investment from {stock.yearlyEarnings[0]?.period} to present
        </div>
      </div>
    </section>
  );
};

export default InvestmentSimulation;
