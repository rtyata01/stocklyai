import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "stockly_visitor_id";

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

export function useVisitStats() {
  const [stats, setStats] = useState<VisitStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const visitorId = getVisitorId();
      // Throttle inserts: 1 visit per session
      const sessionFlag = sessionStorage.getItem("stockly_visit_logged");
      if (!sessionFlag) {
        sessionStorage.setItem("stockly_visit_logged", "1");
        await supabase.from("site_visits").insert({ visitor_id: visitorId });
      }
      const { data } = await supabase.rpc("get_visit_stats");
      if (!cancelled && data && data.length > 0) {
        setStats({ total: Number(data[0].total_visits), unique: Number(data[0].unique_visitors) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return stats;
}
