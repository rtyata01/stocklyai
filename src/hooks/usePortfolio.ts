import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SectorGroup } from "@/data/stocks";
import {
  getWatchlistSectors,
  saveWatchlistSectors,
  setActiveOwnerKey,
  hasStoredPortfolio,
} from "@/components/ManageWatchlistDialog";

/** Reserved row name used to persist the Portfolio tab in user_watchlists. */
export const PORTFOLIO_LIST_NAME = "__portfolio__";

const encode = (secs: SectorGroup[]): string[] =>
  secs.flatMap((s) => s.tickers.map((t) => `${s.name}||${t}`));

function decode(rows: string[]): SectorGroup[] {
  const map = new Map<string, string[]>();
  for (const entry of rows) {
    const idx = entry.indexOf("||");
    const name = idx === -1 ? "Watchlist" : entry.slice(0, idx);
    const ticker = idx === -1 ? entry : entry.slice(idx + 2);
    if (!ticker) continue;
    if (!map.has(name)) map.set(name, []);
    const arr = map.get(name)!;
    if (!arr.includes(ticker)) arr.push(ticker);
  }
  return Array.from(map.entries()).map(([name, tickers]) => ({ name, tickers }));
}

/**
 * Portfolio source of truth:
 *  - guests: localStorage scoped by visitor ownerKey
 *  - signed-in users: `user_watchlists` row named `__portfolio__`, mirrored to
 *    localStorage scoped by `u:<uid>` for instant loads and offline use.
 * On first sign-in, the device's guest portfolio is migrated up to the account.
 */
export function usePortfolio() {
  const { ownerKey, user, isAuthed, loading: authLoading } = useAuth();
  // Keep the module-level default owner in sync so hooks that read the
  // portfolio without an explicit key (useStockData etc.) stay user-scoped.
  setActiveOwnerKey(ownerKey);

  const [sectors, setSectors] = useState<SectorGroup[]>(() => getWatchlistSectors(ownerKey));

  const sync = useCallback(async () => {
    setActiveOwnerKey(ownerKey);
    const local = getWatchlistSectors(ownerKey);
    setSectors(local);
    if (!isAuthed || !user) return;

    const { data, error } = await supabase
      .from("user_watchlists")
      .select("id,tickers")
      .eq("owner_key", ownerKey)
      .eq("name", PORTFOLIO_LIST_NAME)
      .maybeSingle();

    if (error) { console.warn("portfolio fetch failed", error.message); return; }

    if (data) {
      const remote = decode((data.tickers as string[]) ?? []);
      if (remote.length) {
        saveWatchlistSectors(remote, ownerKey);
        setSectors(remote);
        return;
      }
    }

    // No remote portfolio yet — seed it from this device (account-local first,
    // otherwise the guest portfolio saved before signing in).
    const seed = hasStoredPortfolio(ownerKey) ? local : getWatchlistSectors();
    saveWatchlistSectors(seed, ownerKey);
    setSectors(seed);
    await persistRemote(seed, ownerKey, user.id, data?.id);
  }, [ownerKey, isAuthed, user]);

  useEffect(() => {
    if (authLoading) return;
    void sync();
  }, [authLoading, sync]);

  const save = useCallback(
    async (next: SectorGroup[]) => {
      saveWatchlistSectors(next, ownerKey);
      setSectors(next);
      if (isAuthed && user) {
        try {
          const { data } = await supabase
            .from("user_watchlists")
            .select("id")
            .eq("owner_key", ownerKey)
            .eq("name", PORTFOLIO_LIST_NAME)
            .maybeSingle();
          await persistRemote(next, ownerKey, user.id, data?.id);
        } catch (e) {
          console.warn("portfolio save failed", e);
        }
      }
    },
    [ownerKey, isAuthed, user],
  );

  return { sectors, save, reload: sync };
}

async function persistRemote(
  secs: SectorGroup[],
  ownerKey: string,
  userId: string,
  existingId?: string,
) {
  const tickers = encode(secs);
  if (existingId) {
    const { error } = await supabase
      .from("user_watchlists")
      .update({ tickers })
      .eq("id", existingId);
    if (error) console.warn("portfolio update failed", error.message);
    return;
  }
  const { error } = await supabase.from("user_watchlists").insert({
    owner_key: ownerKey,
    user_id: userId,
    name: PORTFOLIO_LIST_NAME,
    tickers,
  });
  if (error) console.warn("portfolio insert failed", error.message);
}
