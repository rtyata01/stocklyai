import { describe, expect, it } from "vitest";
import { DEFAULT_LEADERS } from "@/data/marketLeaders";
import { sectors } from "@/data/stocks";
import { uniqueStarterName, watchlistStarters } from "@/data/watchlistStarters";

describe("watchlist starters", () => {
  it("copies Buffett's existing holdings without changing the source", () => {
    const source = DEFAULT_LEADERS.find((leader) => leader.id === "buffett");
    const starter = watchlistStarters.find((item) => item.id === "buffett");
    expect(starter?.tickers).toEqual(source?.tickers);
    expect(starter?.tickers).not.toBe(source?.tickers);
  });
  it("uses maintained AI and semiconductor sector stocks", () => {
    expect(watchlistStarters.find((item) => item.id === "ai")?.tickers).toEqual(sectors.filter((sector) => ["Semiconductors", "AI & Data"].includes(sector.name)).flatMap((sector) => sector.tickers));
  });
  it("offers category kings and a genuinely blank list", () => {
    expect(watchlistStarters.find((item) => item.id === "moats")?.tickers.slice().sort()).toEqual(["AAPL", "GOOGL", "MSFT", "NVDA"]);
    expect(watchlistStarters.find((item) => item.id === "blank")?.tickers).toEqual([]);
  });
  it("avoids name collisions case-insensitively", () => {
    expect(uniqueStarterName("My Watchlist", ["my watchlist", "My Watchlist (2)"])).toBe("My Watchlist (3)");
  });
});