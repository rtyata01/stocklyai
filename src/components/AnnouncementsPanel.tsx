import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Megaphone, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWatchlistSectors } from "@/components/ManageWatchlistDialog";
import { toast } from "sonner";

interface Announcement {
  id: string;
  ticker: string;
  title: string;
  note: string;
  type: "alert" | "buy" | "sell" | "watch";
  createdAt: string;
}

const STORAGE_KEY = "stockly-announcements-v1";
const TYPE_COLORS = {
  alert: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  buy:   "bg-pine/10 text-pine border-pine/30",
  sell:  "bg-destructive/10 text-destructive border-destructive/30",
  watch: "bg-primary/10 text-primary border-primary/30",
};

const load = (): Announcement[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
};
const save = (a: Announcement[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(a));

const AnnouncementsPanel = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [ticker, setTicker] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<Announcement["type"]>("alert");

  useEffect(() => { setItems(load()); }, []);

  const add = () => {
    if (!title.trim()) return;
    const next = [
      { id: crypto.randomUUID(), ticker: ticker.trim().toUpperCase(), title: title.trim(), note: note.trim(), type, createdAt: new Date().toISOString() },
      ...items,
    ];
    setItems(next); save(next);
    setTicker(""); setTitle(""); setNote(""); setType("alert");
  };

  const remove = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next); save(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-sm text-muted-foreground">Daily Trade Highlights & Quick Alerts</h3>
      </div>

      <div className="border border-border rounded-sm bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_140px] gap-2">
          <Input placeholder="Ticker (opt)" value={ticker} onChange={(e) => setTicker(e.target.value)} className="font-mono text-sm uppercase" maxLength={6} />
          <Input placeholder="Headline / quick alert…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value as Announcement["type"])} className="bg-background border border-input rounded-md px-3 py-2 text-sm font-mono">
            <option value="alert">Alert</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="watch">Watch</option>
          </select>
        </div>
        <Textarea placeholder="Optional details, price target, reasoning…" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <div className="flex justify-end">
          <Button onClick={add} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Announcement</Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <div className="text-center text-muted-foreground py-12 font-mono text-sm">No announcements yet. Add one above.</div>}
        {items.map((a) => (
          <div key={a.id} className="border border-border rounded-sm bg-card p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className={`text-[10px] font-mono uppercase ${TYPE_COLORS[a.type]}`}>{a.type}</Badge>
                {a.ticker && <Badge className="bg-primary text-primary-foreground font-mono text-[10px] px-2">{a.ticker}</Badge>}
                <span className="font-serif text-sm text-foreground">{a.title}</span>
              </div>
              {a.note && <p className="text-xs text-muted-foreground leading-relaxed">{a.note}</p>}
              <div className="text-[10px] font-mono text-muted-foreground mt-1">
                {new Date(a.createdAt).toLocaleString()}
              </div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Delete announcement" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(a.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementsPanel;
