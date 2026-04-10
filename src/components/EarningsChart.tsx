import { EarningsData, formatCurrency } from "@/data/stocks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";

interface EarningsChartProps {
  data: EarningsData[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const d = payload[0]?.payload as EarningsData;
  if (!d) return null;

  return (
    <div className="bg-background border border-border p-4 rounded-sm shadow-xl font-mono text-xs">
      <div className="text-foreground font-semibold mb-2">{d.period}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">EPS</span>
          <span className="text-foreground">{formatCurrency(d.earnings)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Price</span>
          <span className="text-foreground">{formatCurrency(d.price)}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-pine">Buy</span>
          <span>&lt; {formatCurrency(d.valuation.buy)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Hold</span>
          <span>{formatCurrency(d.valuation.hold[0])} – {formatCurrency(d.valuation.hold[1])}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-rust">Sell</span>
          <span>&gt; {formatCurrency(d.valuation.sell)}</span>
        </div>
      </div>
    </div>
  );
};

const EarningsChart = ({ data }: EarningsChartProps) => {
  return (
    <div className="bg-secondary/30 border border-border rounded-sm p-4 md:p-6">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(16, 10%, 23%)" />
          <XAxis
            dataKey="period"
            tick={{ fill: "hsl(35, 8%, 60%)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "hsl(16, 10%, 23%)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="earnings"
            tick={{ fill: "hsl(35, 8%, 60%)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fill: "hsl(35, 8%, 60%)", fontSize: 11, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            yAxisId="earnings"
            dataKey="earnings"
            fill="hsl(33, 30%, 56%)"
            radius={[2, 2, 0, 0]}
            opacity={0.8}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            stroke="hsl(35, 20%, 90%)"
            strokeWidth={2}
            dot={{ fill: "hsl(35, 20%, 90%)", r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-4 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-primary" /> Earnings (EPS)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-[2px] bg-foreground" /> Price Overlay
        </span>
      </div>
    </div>
  );
};

export default EarningsChart;
