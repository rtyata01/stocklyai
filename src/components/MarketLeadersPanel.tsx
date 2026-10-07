import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import PortfolioTable from "@/components/PortfolioTable";

import { DEFAULT_LEADERS, type Leader } from "@/data/marketLeaders";
export type { Leader } from "@/data/marketLeaders";

const STORAGE_KEY = "market-leaders-v1";
const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,7}$/;

function loadLeaders(): Leader[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LEADERS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      // Data corrections: drop deceased investors, rename changed tickers (SQ -> XYZ).
      return (parsed as Leader[])
        .filter((l) => l.id !== "munger")
        .map((l) => ({ ...l, tickers: l.tickers.map((t) => (t === "SQ" ? "XYZ" : t)) }));
    }
  } catch { /* ignore */ }
  return DEFAULT_LEADERS;
}

export default function MarketLeadersPanel() {
  const [leaders, setLeaders] = useState<Leader[]>(() => loadLeaders());
  const [activeId, setActiveId] = useState<string | null>(() => {
    // Default to Cathie Wood so the panel loads her stocks immediately.
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      const pool = Array.isArray(stored) && stored.length ? stored : DEFAULT_LEADERS;
      return pool.some((l) => l.id === "wood") ? "wood" : pool[0]?.id ?? null;
    } catch {
      return "wood";
    }
  });
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [firm, setFirm] = useState("");
  const [tickers, setTickers] = useState("");

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(leaders)); } catch { /* ignore */ }
  }, [leaders]);

  const active = useMemo(() => leaders.find((l) => l.id === activeId) ?? null, [leaders, activeId]);

  const addLeader = () => {
    const parsed = tickers
      .split(/[\s,]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)
      .filter((t) => TICKER_RE.test(t))
      .slice(0, 15);
    if (!name.trim() || !parsed.length) {
      toast.error("Enter a name and at least one valid ticker");
      return;
    }
    const leader: Leader = {
      id: `${Date.now()}`,
      name: name.trim().slice(0, 60),
      firm: firm.trim().slice(0, 60),
      tickers: parsed,
    };
    setLeaders((prev) => [...prev, leader]);
    setActiveId(leader.id);
    setName(""); setFirm(""); setTickers("");
    setAddOpen(false);
    toast.success(`${leader.name} added`);
  };

  const removeLeader = (id: string) => {
    setLeaders((prev) => prev.filter((l) => l.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return (
    <div className="pb-8">
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {leaders.map((l) => {
          const selected = l.id === activeId;
          return (
            <Badge
              key={l.id}
              variant={selected ? "default" : "outline"}
              className="gap-1 py-1 pl-2.5 pr-1 text-[11px] font-mono cursor-pointer"
              onClick={() => setActiveId(l.id)}
            >
              <span>{l.name}</span>
              <button
                type="button"
                aria-label={`Remove ${l.name}`}
                className="rounded-sm p-0.5 hover:bg-background/30"
                onClick={(e) => { e.stopPropagation(); removeLeader(l.id); }}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Leader
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add market leader</DialogTitle>
              <DialogDescription>Add an investor and the stocks they hold.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name (e.g. Stanley Druckenmiller)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Firm (optional)" value={firm} onChange={(e) => setFirm(e.target.value)} />
              <Input placeholder="Tickers, e.g. NVDA, MSFT, AMZN" value={tickers} onChange={(e) => setTickers(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={addLeader}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!active && (
        <div className="text-center text-muted-foreground py-16 font-mono text-sm">
          Select an investor to see their top 15 holdings.
        </div>
      )}

      {active && (
        <PortfolioTable
          key={active.id}
          sectors={[{ name: `${active.name}${active.firm ? ` — ${active.firm}` : ""}`, tickers: active.tickers }]}
          viewFrom="mylists"
          showRefresh={false}
        />
      )}
    </div>
  );
}
