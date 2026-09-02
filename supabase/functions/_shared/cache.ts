// Shared helper used by edge functions to persist results into the public.app_cache table.
// Uses the service role so writes bypass RLS.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function writeAppCache(key: string, payload: unknown, ttlMs: number) {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const expires_at = new Date(Date.now() + ttlMs).toISOString();
    await sb.from('app_cache').upsert(
      { cache_key: key, payload, expires_at },
      { onConflict: 'cache_key' },
    );
  } catch (e) {
    console.warn('writeAppCache failed:', (e as Error).message);
  }
}

// Reads a cache row regardless of expiry (used as a fallback when the AI gateway rate limits us).
export async function readAppCacheStale(key: string): Promise<any | null> {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await sb.from('app_cache').select('payload').eq('cache_key', key).maybeSingle();
    return data?.payload ?? null;
  } catch {
    return null;
  }
}
