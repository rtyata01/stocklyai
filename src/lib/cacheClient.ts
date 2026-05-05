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
export async function loadFromCache<T>(key: string, ttlMs: number): Promise<T | null> {
  // Layer 1: localStorage
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: CacheEnvelope<T> = JSON.parse(raw);
      if (Date.now() < parsed.expiresAt) return parsed.data;
      localStorage.removeItem(key);
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
