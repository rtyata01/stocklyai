import { describe, expect, it } from "vitest";
import { portfolioToCsv, csvToPortfolio } from "./portfolioCsv";

describe("portfolio CSV", () => {
  it("exports ticker, sector, shares, date_exported columns", () => {
    const csv = portfolioToCsv([{ name: "AI", tickers: ["NVDA"] }], new Date("2026-11-06T12:00:00Z"));
    expect(csv).toBe("ticker,sector,shares,date_exported\nNVDA,AI,,2026-11-06\n");
  });

  it("round-trips an export back into the same holdings", () => {
    const sectors = [{ name: "AI, Chips", tickers: ["NVDA", "AMD"] }, { name: "Energy", tickers: ["OKLO"] }];
    expect(csvToPortfolio(portfolioToCsv(sectors))).toEqual(sectors);
  });

  it("rejects files without ticker and sector columns", () => {
    expect(() => csvToPortfolio("symbol,qty\nAAPL,1")).toThrow();
  });
});
