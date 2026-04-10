export type StockCategory = "high-risk" | "low-risk";

export interface ValuationRange {
  buy: number;
  hold: [number, number];
  sell: number;
}

export interface EarningsData {
  period: string;
  earnings: number;
  price: number;
  valuation: ValuationRange;
}

export interface Stock {
  ticker: string;
  name: string;
  sector: string;
  category: StockCategory;
  currentPrice: number;
  dayMin: number;
  dayMax: number;
  change: number;
  valuation: ValuationRange;
  quarterlyEarnings: EarningsData[];
  yearlyEarnings: EarningsData[];
  simulationStartPrice: number;
}

export const stocks: Stock[] = [
  {
    ticker: "NXUS",
    name: "Nexus Therapeutics",
    sector: "Biotech",
    category: "high-risk",
    currentPrice: 84.20,
    dayMin: 81.50,
    dayMax: 86.90,
    change: 2.4,
    valuation: { buy: 75, hold: [75, 95], sell: 95 },
    quarterlyEarnings: [
      { period: "Q1 2025", earnings: 1.12, price: 72.50, valuation: { buy: 68, hold: [68, 85], sell: 85 } },
      { period: "Q2 2025", earnings: 1.45, price: 78.30, valuation: { buy: 70, hold: [70, 88], sell: 88 } },
      { period: "Q3 2025", earnings: 1.68, price: 80.10, valuation: { buy: 72, hold: [72, 90], sell: 90 } },
      { period: "Q4 2025", earnings: 1.92, price: 84.20, valuation: { buy: 75, hold: [75, 95], sell: 95 } },
    ],
    yearlyEarnings: [
      { period: "2022", earnings: 3.20, price: 52.00, valuation: { buy: 45, hold: [45, 60], sell: 60 } },
      { period: "2023", earnings: 4.10, price: 61.40, valuation: { buy: 55, hold: [55, 72], sell: 72 } },
      { period: "2024", earnings: 5.25, price: 72.80, valuation: { buy: 65, hold: [65, 82], sell: 82 } },
      { period: "2025", earnings: 6.17, price: 84.20, valuation: { buy: 75, hold: [75, 95], sell: 95 } },
    ],
    simulationStartPrice: 52.00,
  },
  {
    ticker: "AERX",
    name: "Aero Dynamics Intl.",
    sector: "Aerospace",
    category: "high-risk",
    currentPrice: 215.75,
    dayMin: 210.20,
    dayMax: 220.40,
    change: -0.8,
    valuation: { buy: 195, hold: [195, 230], sell: 230 },
    quarterlyEarnings: [
      { period: "Q1 2025", earnings: 3.80, price: 198.50, valuation: { buy: 185, hold: [185, 215], sell: 215 } },
      { period: "Q2 2025", earnings: 4.10, price: 210.20, valuation: { buy: 190, hold: [190, 220], sell: 220 } },
      { period: "Q3 2025", earnings: 4.25, price: 218.60, valuation: { buy: 192, hold: [192, 225], sell: 225 } },
      { period: "Q4 2025", earnings: 4.50, price: 215.75, valuation: { buy: 195, hold: [195, 230], sell: 230 } },
    ],
    yearlyEarnings: [
      { period: "2022", earnings: 12.50, price: 145.00, valuation: { buy: 130, hold: [130, 165], sell: 165 } },
      { period: "2023", earnings: 14.20, price: 168.30, valuation: { buy: 150, hold: [150, 185], sell: 185 } },
      { period: "2024", earnings: 15.80, price: 192.40, valuation: { buy: 175, hold: [175, 210], sell: 210 } },
      { period: "2025", earnings: 16.65, price: 215.75, valuation: { buy: 195, hold: [195, 230], sell: 230 } },
    ],
    simulationStartPrice: 145.00,
  },
  {
    ticker: "SYN",
    name: "Syndicate Materials",
    sector: "Materials",
    category: "high-risk",
    currentPrice: 42.10,
    dayMin: 40.80,
    dayMax: 43.50,
    change: 5.1,
    valuation: { buy: 35, hold: [35, 50], sell: 50 },
    quarterlyEarnings: [
      { period: "Q1 2025", earnings: 0.62, price: 32.40, valuation: { buy: 28, hold: [28, 38], sell: 38 } },
      { period: "Q2 2025", earnings: 0.78, price: 35.80, valuation: { buy: 30, hold: [30, 42], sell: 42 } },
      { period: "Q3 2025", earnings: 0.95, price: 38.90, valuation: { buy: 32, hold: [32, 45], sell: 45 } },
      { period: "Q4 2025", earnings: 1.10, price: 42.10, valuation: { buy: 35, hold: [35, 50], sell: 50 } },
    ],
    yearlyEarnings: [
      { period: "2022", earnings: 1.80, price: 22.50, valuation: { buy: 18, hold: [18, 28], sell: 28 } },
      { period: "2023", earnings: 2.30, price: 28.40, valuation: { buy: 22, hold: [22, 34], sell: 34 } },
      { period: "2024", earnings: 2.90, price: 35.20, valuation: { buy: 28, hold: [28, 42], sell: 42 } },
      { period: "2025", earnings: 3.45, price: 42.10, valuation: { buy: 35, hold: [35, 50], sell: 50 } },
    ],
    simulationStartPrice: 22.50,
  },
  {
    ticker: "GLDR",
    name: "Golder Trust Corp.",
    sector: "Finance",
    category: "high-risk",
    currentPrice: 128.50,
    dayMin: 125.30,
    dayMax: 131.20,
    change: 3.2,
    valuation: { buy: 110, hold: [110, 140], sell: 140 },
    quarterlyEarnings: [
      { period: "Q1 2025", earnings: 2.10, price: 115.20, valuation: { buy: 100, hold: [100, 125], sell: 125 } },
      { period: "Q2 2025", earnings: 2.35, price: 120.40, valuation: { buy: 105, hold: [105, 130], sell: 130 } },
      { period: "Q3 2025", earnings: 2.55, price: 124.80, valuation: { buy: 108, hold: [108, 135], sell: 135 } },
      { period: "Q4 2025", earnings: 2.80, price: 128.50, valuation: { buy: 110, hold: [110, 140], sell: 140 } },
    ],
    yearlyEarnings: [
      { period: "2022", earnings: 7.20, price: 85.00, valuation: { buy: 72, hold: [72, 98], sell: 98 } },
      { period: "2023", earnings: 8.10, price: 98.40, valuation: { buy: 85, hold: [85, 112], sell: 112 } },
      { period: "2024", earnings: 9.00, price: 112.60, valuation: { buy: 95, hold: [95, 125], sell: 125 } },
      { period: "2025", earnings: 9.80, price: 128.50, valuation: { buy: 110, hold: [110, 140], sell: 140 } },
    ],
    simulationStartPrice: 85.00,
  },
  {
    ticker: "VNT",
    name: "Vantage Holdings",
    sector: "Utilities",
    category: "low-risk",
    currentPrice: 62.30,
    dayMin: 61.80,
    dayMax: 63.10,
    change: 0.4,
    valuation: { buy: 55, hold: [55, 68], sell: 68 },
    quarterlyEarnings: [
      { period: "Q1 2025", earnings: 1.20, price: 59.80, valuation: { buy: 52, hold: [52, 65], sell: 65 } },
      { period: "Q2 2025", earnings: 1.25, price: 60.40, valuation: { buy: 53, hold: [53, 66], sell: 66 } },
      { period: "Q3 2025", earnings: 1.30, price: 61.20, valuation: { buy: 54, hold: [54, 67], sell: 67 } },
      { period: "Q4 2025", earnings: 1.35, price: 62.30, valuation: { buy: 55, hold: [55, 68], sell: 68 } },
    ],
    yearlyEarnings: [
      { period: "2022", earnings: 4.50, price: 52.00, valuation: { buy: 45, hold: [45, 58], sell: 58 } },
      { period: "2023", earnings: 4.70, price: 55.40, valuation: { buy: 48, hold: [48, 61], sell: 61 } },
      { period: "2024", earnings: 4.90, price: 58.80, valuation: { buy: 51, hold: [51, 64], sell: 64 } },
      { period: "2025", earnings: 5.10, price: 62.30, valuation: { buy: 55, hold: [55, 68], sell: 68 } },
    ],
    simulationStartPrice: 52.00,
  },
  {
    ticker: "STBL",
    name: "Stabilitas Energy",
    sector: "Energy",
    category: "low-risk",
    currentPrice: 94.60,
    dayMin: 93.90,
    dayMax: 95.40,
    change: 0.8,
    valuation: { buy: 85, hold: [85, 102], sell: 102 },
    quarterlyEarnings: [
      { period: "Q1 2025", earnings: 1.80, price: 90.20, valuation: { buy: 82, hold: [82, 98], sell: 98 } },
      { period: "Q2 2025", earnings: 1.90, price: 91.80, valuation: { buy: 83, hold: [83, 99], sell: 99 } },
      { period: "Q3 2025", earnings: 2.00, price: 93.40, valuation: { buy: 84, hold: [84, 100], sell: 100 } },
      { period: "Q4 2025", earnings: 2.10, price: 94.60, valuation: { buy: 85, hold: [85, 102], sell: 102 } },
    ],
    yearlyEarnings: [
      { period: "2022", earnings: 6.80, price: 78.00, valuation: { buy: 68, hold: [68, 86], sell: 86 } },
      { period: "2023", earnings: 7.10, price: 83.20, valuation: { buy: 72, hold: [72, 90], sell: 90 } },
      { period: "2024", earnings: 7.40, price: 88.40, valuation: { buy: 78, hold: [78, 96], sell: 96 } },
      { period: "2025", earnings: 7.80, price: 94.60, valuation: { buy: 85, hold: [85, 102], sell: 102 } },
    ],
    simulationStartPrice: 78.00,
  },
  {
    ticker: "DVDN",
    name: "Dividend Shield Inc.",
    sector: "Finance",
    category: "low-risk",
    currentPrice: 156.20,
    dayMin: 155.40,
    dayMax: 157.80,
    change: 0.3,
    valuation: { buy: 140, hold: [140, 168], sell: 168 },
    quarterlyEarnings: [
      { period: "Q1 2025", earnings: 3.20, price: 150.40, valuation: { buy: 135, hold: [135, 162], sell: 162 } },
      { period: "Q2 2025", earnings: 3.30, price: 152.80, valuation: { buy: 137, hold: [137, 164], sell: 164 } },
      { period: "Q3 2025", earnings: 3.40, price: 154.60, valuation: { buy: 138, hold: [138, 166], sell: 166 } },
      { period: "Q4 2025", earnings: 3.50, price: 156.20, valuation: { buy: 140, hold: [140, 168], sell: 168 } },
    ],
    yearlyEarnings: [
      { period: "2022", earnings: 11.80, price: 128.00, valuation: { buy: 112, hold: [112, 142], sell: 142 } },
      { period: "2023", earnings: 12.20, price: 136.40, valuation: { buy: 120, hold: [120, 150], sell: 150 } },
      { period: "2024", earnings: 12.60, price: 145.80, valuation: { buy: 130, hold: [130, 158], sell: 158 } },
      { period: "2025", earnings: 13.40, price: 156.20, valuation: { buy: 140, hold: [140, 168], sell: 168 } },
    ],
    simulationStartPrice: 128.00,
  },
  {
    ticker: "MDRN",
    name: "Modernix Tech",
    sector: "Technology",
    category: "high-risk",
    currentPrice: 312.80,
    dayMin: 305.60,
    dayMax: 318.40,
    change: 1.9,
    valuation: { buy: 280, hold: [280, 340], sell: 340 },
    quarterlyEarnings: [
      { period: "Q1 2025", earnings: 5.20, price: 285.40, valuation: { buy: 260, hold: [260, 310], sell: 310 } },
      { period: "Q2 2025", earnings: 5.80, price: 295.60, valuation: { buy: 268, hold: [268, 320], sell: 320 } },
      { period: "Q3 2025", earnings: 6.10, price: 302.80, valuation: { buy: 275, hold: [275, 330], sell: 330 } },
      { period: "Q4 2025", earnings: 6.50, price: 312.80, valuation: { buy: 280, hold: [280, 340], sell: 340 } },
    ],
    yearlyEarnings: [
      { period: "2022", earnings: 16.40, price: 195.00, valuation: { buy: 170, hold: [170, 220], sell: 220 } },
      { period: "2023", earnings: 18.90, price: 235.20, valuation: { buy: 205, hold: [205, 260], sell: 260 } },
      { period: "2024", earnings: 21.20, price: 275.60, valuation: { buy: 245, hold: [245, 305], sell: 305 } },
      { period: "2025", earnings: 23.60, price: 312.80, valuation: { buy: 280, hold: [280, 340], sell: 340 } },
    ],
    simulationStartPrice: 195.00,
  },
];

export function getSignal(stock: Stock): "buy" | "hold" | "sell" {
  if (stock.currentPrice < stock.valuation.buy) return "buy";
  if (stock.currentPrice > stock.valuation.sell) return "sell";
  return "hold";
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function simulateInvestment(stock: Stock, amount = 1000) {
  const shares = amount / stock.simulationStartPrice;
  const currentValue = shares * stock.currentPrice;
  const profitLoss = currentValue - amount;
  const profitLossPercent = (profitLoss / amount) * 100;
  return { shares, currentValue, profitLoss, profitLossPercent };
}
