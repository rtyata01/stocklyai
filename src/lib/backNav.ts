/**
 * Generic, future-proof "back" navigation for the stock detail page.
 *
 * Any page linking to /stock/:ticker encodes its own location (pathname + search)
 * in the `from` query param. The detail page decodes it and derives a friendly
 * label, so new pages work automatically without extra wiring.
 */

const TAB_LABELS: Record<string, string> = {
  portfolio: "Portfolio",
  mylists: "My Watchlist",
  market: "Market Watchlist",
  leaders: "Market Leaders",
  compare: "AI Compare",
  cycle: "Cycle Trading",
  swing: "Swing Trading",
  earnings: "Earnings Momentum",
  announcements: "Announcements",
  basics: "Trading 101",
};

/** Build a stock detail link that remembers the current page. */
export function buildStockLink(ticker: string, origin: { pathname: string; search: string }): string {
  const from = `${origin.pathname}${origin.search ?? ""}`;
  return `/stock/${encodeURIComponent(ticker)}?from=${encodeURIComponent(from)}`;
}

/** Resolve the `from` param into a destination path and a human label. */
export function resolveBack(from: string | null): { to: string; label: string } {
  // Legacy values still used by older links.
  if (!from) return { to: "/", label: "Back to Portfolio" };
  if (from === "mylists" || from === "portfolio") {
    return {
      to: from === "mylists" ? "/?tab=mylists" : "/",
      label: `Back to ${TAB_LABELS[from]}`,
    };
  }

  // Only accept same-origin relative paths.
  if (!from.startsWith("/") || from.startsWith("//")) {
    return { to: "/", label: "Back to Portfolio" };
  }

  const [path, search = ""] = from.split("?");
  const tab = new URLSearchParams(search).get("tab");
  const label = tab
    ? TAB_LABELS[tab] ?? "Previous Page"
    : path === "/"
      ? TAB_LABELS.portfolio
      : "Previous Page";

  return { to: from, label: `Back to ${label}` };
}
