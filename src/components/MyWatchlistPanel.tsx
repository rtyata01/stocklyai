import { useMemo, useState } from "react";
import { Plus, Trash2, X, Bookmark, Newspaper, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUserWatchlists, UserWatchlist } from "@/hooks/useUserWatchlists";
import { useAuth } from "@/hooks/useAuth";
import { SectorGroup } from "@/data/stocks";
import PortfolioTable from "@/components/PortfolioTable";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BreakingItem {
  ticker: string;
  title: string;
  note: string;
  type: "alert" | "buy" | "sell" | "watch";
  price?: number;
}

const TYPE_COLORS: Record<BreakingItem["type"], string> = {
  alert: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  buy: "bg-pine/10 text-pine border-pine/30",
  sell: "bg-destructive/10 text-destructive border-destructive/30",
  watch: "bg-primary/10 text-primary border-primary/30",
};

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,7}$/;

function normalizeTickers(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((t) => TICKER_RE.test(t));
}

export default function MyWatchlistPanel() {
  const { isAuthed } = useAuth();
  const { lists, loading, create, remove, update } = useUserWatchlists();
  const [activeId, setActiveId] = useState<string | null>(null);

  const active: UserWatchlist | null = useMemo(() => {
    if (!lists.length) return null;
    const found = lists.find((l) => l.id === activeId);
    return found ?? lists[0];
  }, [lists, activeId]);

  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="pb-8">
      {!isAuthed && (
        <div className="mb-3 text-[11px] font-mono text-muted-foreground bg-secondary/40 border border-border rounded-sm px-3 py-2">
          Signed in as guest — watchlists are saved on this device. <a href="/auth" className="text-primary underline underline-offset-2">Sign in</a> to sync across devices.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Bookmark className="h-4 w-4 text-muted-foreground" />
        {lists.length === 0 && (
          <span className="text-xs font-mono text-muted-foreground">
            {loading ? "Loading…" : "No watchlists yet."}
          </span>
        )}
        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveId(l.id)}
            className={`text-xs font-mono px-2.5 py-1 rounded-sm border transition-colors ${
              active?.id === l.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
            }`}
          >
            {l.name}
            <span className="ml-1.5 opacity-70">({l.tickers.length})</span>
          </button>
        ))}
        <CreateListDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreate={async (name, tickers) => {
            try {
              const w = await create(name, tickers);
              setActiveId(w.id);
              toast.success(`Created "${w.name}"`);
              setCreateOpen(false);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Failed to create";
              toast.error(msg.includes("unique") ? "A watchlist with that name already exists" : msg);
            }
          }}
        />
      </div>

      {active && (
        <PortfolioTable
          key={active.id}
          sectors={[{ name: active.name, tickers: active.tickers } as SectorGroup]}
          emptyMessage="This watchlist has no stocks yet. Click 'Manage Stocks' to add some."
          viewFrom="mylists"
          toolbarExtras={
            <>
              <ManageTickersDialog
                open={manageOpen}
                onOpenChange={setManageOpen}
                watchlist={active}
                onSave={async (tickers) => {
                  try {
                    await update(active.id, { tickers });
                    toast.success("Watchlist updated");
                    setManageOpen(false);
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Update failed");
                  }
                }}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{active.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await remove(active.id);
                          setActiveId(null);
                          toast.success("Watchlist deleted");
                        } catch (e: unknown) {
                          toast.error(e instanceof Error ? e.message : "Delete failed");
                        }
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          }
        />
      )}
    </div>
  );
}

/* --------------------------------- dialogs -------------------------------- */

function CreateListDialog({
  open, onOpenChange, onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string, tickers: string[]) => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [tickersInput, setTickersInput] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setName(""); setTickersInput(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Watchlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New watchlist</DialogTitle>
          <DialogDescription>Give it a unique name and (optionally) some tickers.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI Leaders" maxLength={60} />
          </div>
          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground">Tickers (optional)</label>
            <Input
              value={tickersInput}
              onChange={(e) => setTickersInput(e.target.value)}
              placeholder="NVDA, AAPL, MSFT"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Comma or space separated.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const clean = name.trim();
              if (!clean) { toast.error("Name required"); return; }
              onCreate(clean, normalizeTickers(tickersInput));
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageTickersDialog({
  open, onOpenChange, watchlist, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  watchlist: UserWatchlist;
  onSave: (tickers: string[]) => void;
}) {
  const [tickers, setTickers] = useState<string[]>(watchlist.tickers);
  const [input, setInput] = useState("");

  // reset when opening
  const handleOpenChange = (v: boolean) => {
    if (v) setTickers(watchlist.tickers);
    onOpenChange(v);
  };

  const add = () => {
    const additions = normalizeTickers(input);
    if (!additions.length) { toast.error("Enter valid tickers"); return; }
    setTickers(Array.from(new Set([...tickers, ...additions])));
    setInput("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Manage Stocks
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage stocks — {watchlist.name}</DialogTitle>
          <DialogDescription>Add or remove tickers in this watchlist.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add tickers (e.g. NVDA, AAPL)"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
          <Button onClick={add} size="sm">Add</Button>
        </div>

        <div className="flex flex-wrap gap-1.5 min-h-[48px] p-2 border border-border rounded-sm bg-secondary/30 max-h-[240px] overflow-y-auto">
          {tickers.length === 0 && (
            <span className="text-xs font-mono text-muted-foreground self-center">No tickers yet.</span>
          )}
          {tickers.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 font-mono">
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => setTickers(tickers.filter((x) => x !== t))}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(tickers)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
