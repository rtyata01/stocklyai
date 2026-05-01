import { BookOpen, Wallet, Repeat, ShieldCheck, Clock } from "lucide-react";

const PRINCIPLES = [
  { icon: Repeat, title: "Invest incrementally, not all at once", text: "Use dollar-cost averaging — split your investment across weeks or months. This averages out volatility and removes the stress of timing the perfect entry." },
  { icon: Clock, title: "Long-term mindset, short-term opportunism", text: "Most wealth comes from holding great businesses for years. But stay alert — sharp dips, FDA approvals, or earnings beats can offer 1–4 week swing profits." },
  { icon: Wallet, title: "Keep a cash buffer", text: "Just like an emergency fund, keep 10–25% of your investing capital in cash. This lets you buy aggressively during corrections instead of being fully invested at the top." },
  { icon: ShieldCheck, title: "Use Buy / Hold / Sell zones", text: "Set fair-value bands before you buy. Buy below fair value with a margin of safety (15–30%). Sell when price stretches well above intrinsic value." },
  { icon: BookOpen, title: "Position size = conviction × risk", text: "Higher conviction + lower risk = larger position. Speculative trades (biotech, small caps) should be small slices, never your core portfolio." },
];

const METRICS = [
  {
    category: "Value",
    color: "text-primary border-primary/40 bg-primary/10",
    items: [
      { name: "P/E (Price-to-Earnings)", formula: "Price ÷ EPS", text: "How many years of current earnings you pay for the stock. Lower is cheaper. Tech: 25–40 is normal. Banks: 8–15. Example: $100 stock, $5 EPS → P/E = 20." },
      { name: "P/B (Price-to-Book)", formula: "Price ÷ Book Value", text: "Compares price to net asset value. < 1 = trading below book value (potential bargain or distressed). Useful for banks & industrials." },
      { name: "P/S (Price-to-Sales)", formula: "Price ÷ Revenue per Share", text: "Useful when company isn't profitable yet. < 2 = cheap, > 10 = pricey. Typical for SaaS / growth stocks." },
    ],
  },
  {
    category: "Profitability",
    color: "text-pine border-pine/40 bg-pine/10",
    items: [
      { name: "EPS (Earnings Per Share)", formula: "Net Income ÷ Shares Outstanding", text: "How much profit each share earns. Rising EPS = healthy growth. Example: $1B profit, 500M shares → $2 EPS." },
      { name: "Net Income / Net Profit", formula: "Revenue − all costs & taxes", text: "The bottom line. Consistent positive net income separates real businesses from story stocks." },
      { name: "Profit Margin", formula: "Net Income ÷ Revenue", text: "How much of every $1 of sales becomes profit. Software: 20–40%. Retail: 2–8%. Higher = better pricing power." },
      { name: "ROE (Return on Equity)", formula: "Net Income ÷ Shareholder Equity", text: "How efficiently management turns shareholder money into profits. > 15% is excellent." },
    ],
  },
  {
    category: "Growth",
    color: "text-primary border-primary/40 bg-primary/10",
    items: [
      { name: "Revenue Growth", formula: "(This Quarter − Last Year Same Quarter) ÷ Last Year", text: "Top-line growth. > 20% YoY = strong growth stock. Decelerating revenue is a major warning sign." },
      { name: "PEG Ratio", formula: "P/E ÷ Earnings Growth Rate", text: "P/E adjusted for growth. < 1 = potentially undervalued, ~1 = fair, > 1.5 = expensive even after growth." },
    ],
  },
  {
    category: "Stability / Risk",
    color: "text-yellow-500 border-yellow-500/40 bg-yellow-500/10",
    items: [
      { name: "Debt-to-Equity (D/E)", formula: "Total Debt ÷ Equity", text: "How leveraged the company is. < 1 = conservative. > 2 = risky in downturns. Different norms by sector (utilities run high)." },
      { name: "Current Ratio", formula: "Current Assets ÷ Current Liabilities", text: "Can it pay short-term bills? > 1.5 = healthy liquidity." },
    ],
  },
  {
    category: "Cash Strength",
    color: "text-pine border-pine/40 bg-pine/10",
    items: [
      { name: "FCF (Free Cash Flow)", formula: "Operating Cash Flow − CapEx", text: "Real cash left over after running the business. Best signal of true profitability — harder to fake than earnings." },
      { name: "FCF Yield", formula: "FCF ÷ Market Cap", text: "How much cash you 'earn' per dollar invested. > 5% = attractive cash generator." },
    ],
  },
  {
    category: "Income",
    color: "text-primary border-primary/40 bg-primary/10",
    items: [
      { name: "Dividend Yield", formula: "Annual Dividend ÷ Price", text: "Cash return as % of price. 2–4% common for blue chips. > 6% — verify it's sustainable (high yield can signal distress)." },
      { name: "Payout Ratio", formula: "Dividend ÷ Net Income", text: "% of profit paid out. < 60% = sustainable. > 100% = company paying more than it earns (red flag)." },
    ],
  },
];

const InvestingBasicsPanel = () => {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-sm text-muted-foreground">Trading Principles</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRINCIPLES.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="border border-border rounded-sm bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h4 className="font-serif text-sm text-foreground">{p.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-serif text-sm text-muted-foreground mb-3">Stock Fundamentals — What the Numbers Mean</h3>
        <div className="space-y-4">
          {METRICS.map((cat) => (
            <div key={cat.category} className="border border-border rounded-sm bg-card overflow-hidden">
              <div className={`px-4 py-2 border-b border-border ${cat.color} font-mono text-[11px] uppercase tracking-widest`}>
                {cat.category}
              </div>
              <div className="divide-y divide-border">
                {cat.items.map((m) => (
                  <div key={m.name} className="p-4">
                    <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                      <h4 className="font-serif text-sm text-foreground">{m.name}</h4>
                      <code className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{m.formula}</code>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{m.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InvestingBasicsPanel;
