import { supabase } from "@/integrations/supabase/client";

interface CacheEnvelope<T> {
  data: T;
  ts: number;
  expiresAt: number;
}

/**
 * Two-layer cache:
 *   1) localStorage (instant, per-browser)
 *   2) Supabase `app_cache` table (shared across users/devices, written by edge functions)
 *
 * Use `loadFromCache` first; on miss, call your edge function (which will populate the
 * shared `app_cache`) and then `saveLocalCache` so the local layer stays warm.
 */
/** Synchronously read the last-known local value, even if expired (for stale-while-revalidate). */
export function readStaleLocal<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return (JSON.parse(raw) as CacheEnvelope<T>).data;
  } catch {
    return undefined;
  }
}

const LAST_QUOTES = "last-known:quotes";
const LAST_EVALS = "last-known:evaluations";

function readMap<T>(k: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(k) ?? "{}"); } catch { return {}; }
}
function mergeMap<T extends { ticker: string }>(k: string, items: T[]) {
  try {
    const m = readMap<T>(k);
    items.forEach((i) => { if (i?.ticker) m[i.ticker] = i; });
    localStorage.setItem(k, JSON.stringify(m));
  } catch { /* ignore */ }
}
/** Per-ticker last-known stores, shared across all tables/tabs. */
export const lastKnown = {
  quotes: <T extends { ticker: string }>(tickers: string[]): T[] => {
    const m = readMap<T>(LAST_QUOTES);
    return tickers.map((t) => m[t]).filter(Boolean) as T[];
  },
  saveQuotes: <T extends { ticker: string }>(items: T[]) => mergeMap(LAST_QUOTES, items),
  evals: <T extends { ticker: string }>(tickers: string[]): T[] => {
    const m = readMap<T>(LAST_EVALS);
    return tickers.map((t) => m[t]).filter(Boolean) as T[];
  },
  saveEvals: <T extends { ticker: string }>(items: T[]) => mergeMap(LAST_EVALS, items),
};

export async function loadFromCache<T>(key: string, ttlMs: number): Promise<T | null> {
  // Layer 1: localStorage (expired entries are kept as stale fallbacks)
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: CacheEnvelope<T> = JSON.parse(raw);
      if (Date.now() < parsed.expiresAt) return parsed.data;
    }
  } catch {
    /* ignore */
  }

  // Layer 2: shared backend cache
  try {
    const { data, error } = await supabase
      .from("app_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (error || !data) return null;
    if (new Date(data.expires_at).getTime() <= Date.now()) return null;
    saveLocalCache(key, data.payload as T, ttlMs);
    return data.payload as T;
  } catch {
    return null;
  }
}

export function saveLocalCache<T>(key: string, data: T, ttlMs: number) {
  try {
    const env: CacheEnvelope<T> = { data, ts: Date.now(), expiresAt: Date.now() + ttlMs };
    localStorage.setItem(key, JSON.stringify(env));
  } catch {
    /* ignore quota errors */
  }
}

export function clearCache(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
