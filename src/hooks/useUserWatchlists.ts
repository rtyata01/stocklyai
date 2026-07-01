import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserWatchlist {
  id: string;
  name: string;
  tickers: string[];
  updated_at?: string;
}

const cacheKey = (ownerKey: string) => `stockly_user_watchlists:${ownerKey}`;

function readCache(ownerKey: string): UserWatchlist[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(ownerKey));
    return raw ? (JSON.parse(raw) as UserWatchlist[]) : null;
  } catch { return null; }
}
function writeCache(ownerKey: string, lists: UserWatchlist[]) {
  try { localStorage.setItem(cacheKey(ownerKey), JSON.stringify(lists)); } catch { /* ignore */ }
}

export function useUserWatchlists() {
  const { ownerKey, user } = useAuth();
  const [lists, setLists] = useState<UserWatchlist[]>(() => readCache(ownerKey) ?? []);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_watchlists")
      .select("id,name,tickers,updated_at")
      .eq("owner_key", ownerKey)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) { console.warn("watchlist fetch failed", error.message); return; }
    const next = (data ?? []) as UserWatchlist[];
    setLists(next);
    writeCache(ownerKey, next);
  }, [ownerKey]);

  useEffect(() => {
    setLists(readCache(ownerKey) ?? []);
    reload();
  }, [ownerKey, reload]);

  const create = async (name: string, tickers: string[] = []) => {
    const clean = name.trim();
    if (!clean) throw new Error("Name required");
    const row = {
      owner_key: ownerKey,
      user_id: user?.id ?? null,
      name: clean,
      tickers: tickers.map((t) => t.toUpperCase()),
    };
    const { data, error } = await supabase
      .from("user_watchlists")
      .insert(row)
      .select("id,name,tickers,updated_at")
      .single();
    if (error) throw error;
    const next = [...lists, data as UserWatchlist];
    setLists(next); writeCache(ownerKey, next);
    return data as UserWatchlist;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("user_watchlists").delete().eq("id", id);
    if (error) throw error;
    const next = lists.filter((l) => l.id !== id);
    setLists(next); writeCache(ownerKey, next);
  };

  const update = async (id: string, patch: Partial<Pick<UserWatchlist, "name" | "tickers">>) => {
    const body: { name?: string; tickers?: string[] } = {};
    if (patch.name !== undefined) body.name = patch.name.trim();
    if (patch.tickers !== undefined) body.tickers = patch.tickers.map((t) => t.toUpperCase());
    const { data, error } = await supabase
      .from("user_watchlists")
      .update(body)
      .eq("id", id)
      .select("id,name,tickers,updated_at")
      .single();
    if (error) throw error;
    const next = lists.map((l) => (l.id === id ? (data as UserWatchlist) : l));
    setLists(next); writeCache(ownerKey, next);
    return data as UserWatchlist;
  };

  return { lists, loading, reload, create, remove, update };
}
