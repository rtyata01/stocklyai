# STOCKLYAI — High-Level Design & Code Flow

AI-powered stock portfolio & analytics dashboard.
Stack: React 18 + Vite + TypeScript + Tailwind + shadcn/ui, TanStack Query, Lovable Cloud backend (Postgres + Edge Functions), Lovable AI Gateway for LLM calls.

---

## 1. System overview

```text
 Browser (React SPA)
   │  hooks (TanStack Query) ── localStorage cache (layer 1)
   │
   ▼  supabase.functions.invoke() / supabase.from()
 Edge Functions (Deno)  ── app_cache table (layer 2, shared)
   │
   ├── Market data: Yahoo Finance, Alpha Vantage
   └── AI reasoning: Lovable AI Gateway (LOVABLE_API_KEY)
   │
   ▼
 Postgres (RLS enforced): user_watchlists, app_cache, stock_news, site_visits
```

Key principle: **the browser never calls a market-data or AI provider directly**. Every external call runs inside an edge function so keys stay server-side and results can be cached for all users.

---

## 2. Directory map

| Path | Role |
|---|---|
| `src/pages/Index.tsx` | Dashboard shell: header, theme, auth menu, tab router, portfolio tab content |
| `src/pages/StockDetail.tsx` | Per-ticker deep dive (charts, catalysts, bull/bear/risk) |
| `src/pages/Auth.tsx` | Sign in / sign up (Google OAuth + email) |
| `src/components/*Panel.tsx` | One component per dashboard tab |
| `src/components/PortfolioTable.tsx` | Shared sortable table used by Portfolio and My Watchlist |
| `src/hooks/` | Data-access layer — all backend access goes through a hook |
| `src/lib/cacheClient.ts` | Two-layer cache helper |
| `src/data/stocks.ts` | Default sectors / tickers seed |
| `supabase/functions/` | Edge functions (one folder = one endpoint) |
| `supabase/functions/_shared/` | `cache.ts` (server cache writes), `validation.ts` (ticker/input guards) |
| `supabase/migrations/` | SQL schema + RLS policies |

---

## 3. Tabs and their data sources

| Tab | Component | Edge function(s) | Trigger |
|---|---|---|---|
| My Watchlist | `MyWatchlistPanel` | `fetch-stocks`, `evaluate-prices` | on mount |
| Portfolio | `Index.tsx` + `PortfolioTable` | `fetch-stocks`, `evaluate-prices` | on mount / Re-evaluate |
| Trading 101 | `InvestingBasicsPanel` | none (static + daily rotation) | auto-shuffle on mount |
| AI Compare | `StockComparisonPanel` | `compare-stocks` | user selects tickers |
| Earnings Momentum | `NewsPanel` | `scrape-news` | auto "Find Best Picks" on mount |
| Swing Trading | `SwingTradingPanel` | `scrape-swing-signals` | on mount |
| Cycle Trading | `CycleTradingPanel` | `detect-cycles` | auto on mount |
| Announcements | `AnnouncementsPanel` | `breaking-alert` | auto on mount |

Dialogs: `PortfolioSummaryDialog` ("Portfolio Pulse" → `portfolio-analytics`), `PortfolioBriefingDialog` ("Weekly Debrief" → `portfolio-briefing`), `ManageWatchlistDialog` (portfolio membership editor).

---

## 4. Caching model

Two layers, coordinated by `src/lib/cacheClient.ts`:

1. **localStorage** — instant, per-browser, TTL envelope `{ data, ts, expiresAt }`.
2. **`app_cache` table** — shared across users/devices, written by edge functions.

Read path:

```text
loadFromCache(key, ttl)
  → localStorage hit & fresh? return
  → else app_cache row fresh? warm localStorage, return
  → else null → hook invokes edge function → fn writes app_cache
                → hook calls saveLocalCache()
```

Typical TTLs: quotes 15 min, AI price evaluations 24 h. `refreshNonce` (incremented by **Re-evaluate**) is part of the React Query key and forces a cache bypass end-to-end.

---

## 5. Core hooks

| Hook | Responsibility |
|---|---|
| `useStockData(refreshNonce, tickersOverride?)` | Live quotes/volume via `fetch-stocks`; ticker set derives from active portfolio |
| `usePriceEvaluations(tickers, nonce)` | AI BUY / HOLD / SELL fair-value bands via `evaluate-prices` |
| `useStockDetail(ticker)` | Detail page fundamentals, earnings series, catalysts |
| `useStockNews` / `useSwingSignals` / `useStockInsights` | Tab-specific AI feeds |
| `useUserWatchlists()` | Named watchlists; DB-backed when signed in, localStorage when guest |
| `useAuth()` | Session + `ownerKey` (user id, else guest visitor id) — the scoping key for all per-user storage |
| `useVisitStats()` | Unique/total visitor counters via `visit-stats` fn + `get_visit_stats()` RPC |
| `useTheme()` | Light / Dark switch |

---

## 6. Valuation & signal logic (where the numbers come from)

- **BUY / HOLD / SELL** (`evaluate-prices`): blends analyst consensus, intrinsic value, PEG ratio, quarterly revenue growth and margins, then applies a 15–30 % margin of safety. All bands are anchored to the *current* live price fetched server-side.
- **Trade levels** (entry / target / stop) in Earnings Momentum, Swing, Cycle and AI Compare are derived from the same live price + evaluation bands so every tab is internally consistent.
- **Earnings Momentum** (`scrape-news`): filters candidates by verified earnings date (short horizon 2–3 weeks, mid horizon 1–2 months) and Risk:Reward ≥ 1:2.
- **Cycle Trading** (`detect-cycles`): deterministic, non-AI swing-high/low detection over Yahoo daily history (3M/6M windows).
- Every computed figure exposes a help icon whose tooltip explains the formula.

---

## 7. Database & security

| Table | Purpose | Access model |
|---|---|---|
| `user_watchlists` | Named lists per authenticated user | RLS: owner-only (`auth.uid() = user_id`), no anon grants |
| `app_cache` | Shared payload cache | Read for clients, writes from service role in edge functions |
| `stock_news` | Persisted news/alerts | Read-only for clients |
| `site_visits` | Visit log | Insert-only; no SELECT policy. Aggregates exposed only via `get_visit_stats()` SECURITY DEFINER |

Rules enforced project-wide: every public table has explicit `GRANT`s plus RLS; edge functions validate tickers/inputs via `_shared/validation.ts`; errors are masked before being returned to the client.

Guest vs. authenticated: guests get a stable `visitor_id` used as `ownerKey`, and all portfolio/watchlist state persists to `localStorage` scoped by that key. Signing in switches `ownerKey` to the user id and syncs to Postgres.

---

## 8. Typical request flow (example: Portfolio tab load)

```text
Index.tsx mounts
 → useStockData()          → cache hit? render : invoke fetch-stocks
                                              → Yahoo Finance quotes+volume
                                              → write app_cache → return
 → usePriceEvaluations()   → cache hit? render : invoke evaluate-prices
                                              → live prices + fundamentals
                                              → Lovable AI Gateway
                                              → write app_cache → return
 → PortfolioTable renders rows, sorting, crown icons, responsive column hiding
```

**Re-evaluate** bumps `refreshNonce`, clears local evaluation keys, refetches quotes + evaluations, and kicks off the breaking-news refresh.

---

## 9. Conventions for maintainers

- All colors/typography come from semantic tokens in `src/index.css` + Tailwind config — never hardcode `text-white`, `bg-[#...]`.
- One panel component per tab; shared table/row rendering lives in `PortfolioTable.tsx`.
- New backend capability = new folder under `supabase/functions/`, reusing `_shared/cache.ts` and `_shared/validation.ts`.
- New client data need = new hook in `src/hooks/`, using `loadFromCache`/`saveLocalCache` and a React Query key that includes the cache key and `refreshNonce`.
- Mobile: wide numeric columns use `hidden md:table-cell` so small screens stay readable.
