export type Leader = { id: string; name: string; firm: string; tickers: string[] };

export const DEFAULT_LEADERS: Leader[] = [
  { id: "buffett", name: "Warren Buffett", firm: "Berkshire Hathaway", tickers: ["AAPL", "AXP", "BAC", "KO", "CVX", "OXY", "MCO", "KHC", "CB", "DVA", "KR", "VRSN", "AMZN", "V", "MA"] },
  { id: "ackman", name: "Bill Ackman", firm: "Pershing Square", tickers: ["UBER", "BN", "HLT", "CMG", "QSR", "HHH", "GOOGL", "NKE", "SEG", "ALX", "AMZN", "FNMA", "FMCC", "RACE", "LOW"] },
  { id: "burry", name: "Michael Burry", firm: "Scion Asset Mgmt", tickers: ["BABA", "JD", "BIDU", "EL", "MOH", "HCA", "BRKR", "ORCL", "PDD", "SBLK", "MGM", "SFIX", "BP", "GEO", "CXW"] },
  { id: "wood", name: "Cathie Wood", firm: "ARK Invest", tickers: ["TSLA", "COIN", "ROKU", "PLTR", "RBLX", "XYZ", "HOOD", "TEM", "CRSP", "PATH", "TDOC", "DKNG", "SHOP", "ZM", "RKLB"] },
  { id: "dalio", name: "Ray Dalio", firm: "Bridgewater", tickers: ["SPY", "IVV", "GLD", "NVDA", "GOOGL", "META", "AMZN", "JNJ", "PG", "COST", "KO", "PEP", "WMT", "MSFT", "AAPL"] },
  { id: "simons", name: "Renaissance Tech", firm: "Medallion", tickers: ["NVDA", "PLTR", "META", "GILD", "VRTX", "NVO", "TSM", "UTHR", "SPOT", "AXON", "APP", "HOOD", "NFLX", "ABBV", "CI"] },
  { id: "griffin", name: "Ken Griffin", firm: "Citadel", tickers: ["NVDA", "AMZN", "MSFT", "META", "AVGO", "LLY", "UNH", "TSLA", "AMD", "GOOGL", "COST", "V", "JPM", "NFLX", "CRM"] },
  { id: "tepper", name: "David Tepper", firm: "Appaloosa", tickers: ["BABA", "PDD", "JD", "AMZN", "META", "MSFT", "GOOGL", "NVDA", "UBER", "ORCL", "LRCX", "AMD", "CAVA", "KWEB", "FXI"] },
  { id: "loeb", name: "Daniel Loeb", firm: "Third Point", tickers: ["AMZN", "PCG", "TSM", "META", "GOOGL", "LSXMK", "APO", "KKR", "CRM", "VST", "TMUS", "DHR", "CEG", "BAC", "LEN"] },
  { id: "einhorn", name: "David Einhorn", firm: "Greenlight", tickers: ["GRBK", "BHF", "CNDT", "SLVM", "CNX", "PENN", "HPQ", "TEVA", "SOLV", "LBRT", "ODP", "WFRD", "GT", "PFGC", "ALIT"] },
  { id: "icahn", name: "Carl Icahn", firm: "Icahn Enterprises", tickers: ["IEP", "CVI", "SWX", "XRX", "BALL", "DAN", "ILMN", "FTV", "CZR", "NWL", "HTZ", "OXY", "SNDK", "AEP", "MSTR"] },
  { id: "klarman", name: "Seth Klarman", firm: "Baupost", tickers: ["LBRDK", "WBD", "CLAR", "GRBK", "VEON", "FWONK", "JAZZ", "HTZ", "ATUS", "QRVO", "SLDP", "GOOGL", "META", "AMZN", "DISH"] },
  { id: "marks", name: "Howard Marks", firm: "Oaktree", tickers: ["OAK", "VST", "TRGP", "CCJ", "FCX", "GLNCY", "STNG", "EQNR", "PBR", "SBLK", "GNK", "TGP", "CHRD", "AR", "EQT"] },
  { id: "bezos", name: "Jeff Bezos", firm: "Bezos Expeditions", tickers: ["AMZN", "RIVN", "GOOGL", "NKE", "UBER", "AI", "PLTR", "SNOW", "TWLO", "NVDA", "RKLB", "ABNB", "GM", "JOBY", "SPOT"] },
];

