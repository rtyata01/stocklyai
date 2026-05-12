import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "stockly_visitor_id";
const STATS_CACHE_KEY = "stockly_visit_stats_max";

// Baseline starting values
const BASELINE_UNIQUE = 2000;
const BASELINE_TOTAL = 5000;

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export interface VisitStats {
  total: number;
  unique: number;
}

function readCachedMax(): VisitStats {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        total: Math.max(BASELINE_TOTAL, Number(p.total) || 0),
        unique: Math.max(BASELINE_UNIQUE, Number(p.unique) || 0),
      };
    }
  } catch { /* ignore */ }
  return { total: BASELINE_TOTAL, unique: BASELINE_UNIQUE };
}

function writeCachedMax(s: VisitStats) {
  try { localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function useVisitStats() {
  const [stats, setStats] = useState<VisitStats | null>(() => readCachedMax());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const visitorId = getVisitorId();
      const sessionFlag = sessionStorage.getItem("stockly_visit_logged");
      if (!sessionFlag) {
        sessionStorage.setItem("stockly_visit_logged", "1");
        try { await supabase.from("site_visits").insert({ visitor_id: visitorId }); } catch { /* ignore */ }
      }
      const { data } = await supabase.functions.invoke("visit-stats", {
        body: { visitorId },
      });
      if (cancelled) return;

      const cached = readCachedMax();
      let total = cached.total;
      let unique = cached.unique;

      if (data) {
        const dbTotal = Number(data.total ?? 0) + BASELINE_TOTAL;
        const dbUnique = Number(data.unique ?? 0) + BASELINE_UNIQUE;
        // Always non-decreasing
        total = Math.max(total, dbTotal);
        unique = Math.max(unique, dbUnique);
      }

      const next = { total, unique };
      writeCachedMax(next);
      setStats(next);
    })();
    return () => { cancelled = true; };
  }, []);

  return stats;
}
