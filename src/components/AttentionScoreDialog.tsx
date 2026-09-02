import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { loadFromCache, saveLocalCache } from "@/lib/cacheClient";
import { RefreshCw, Flame, Eye, Moon, ExternalLink, ChevronDown } from "lucide-react";

export interface AttentionSignal { label: string; weight: number; kind: string }
export interface AttentionRow {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  score: number;
  bucket: "attention" | "watch" | "quiet";
  headline: string;
  signals: AttentionSignal[];
  news?: { title: string; url: string; publisher: string } | null;
}
interface AttentionPayload {
  generatedAt: string;
  attention: AttentionRow[];
  watch: AttentionRow[];
  quiet: AttentionRow[];
  skipped: string[];
}

const TTL = 60 * 60 * 1000; // 1 hour

const toneCls = (v: number) => (v >= 0 ? "text-pine" : "text-destructive");

function RowCard({ row, dense }: { row: AttentionRow; dense?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-sm bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 flex-wrap hover:bg-secondary/40 transition-colors"
      >
        <Badge className="bg-primary text-primary-foreground font-mono text-[10px] px-2">{row.ticker}</Badge>
        {!dense && <span className="font-serif text-sm text-foreground">{row.headline}</span>}
        <span className="text-[11px] font-mono text-muted-foreground">${row.price.toFixed(2)}</span>
        <span className={`text-[11px] font-mono ${toneCls(row.changePct)}`}>
          {row.changePct >= 0 ? "+" : ""}{row.changePct.toFixed(2)}%
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">score {row.score}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border space-y-1.5">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">{row.name}</p>
          {row.signals.length === 0 && (
            <p className="text-xs text-muted-foreground">No material signals detected in the last sessions.</p>
          )}
          {row.signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <Badge variant="outline" className="text-[9px] font-mono uppercase shrink-0">{s.kind}</Badge>
              <span className="text-xs text-muted-foreground leading-relaxed">{s.label}</span>
            </div>
          ))}
          {row.news?.url && (
            <a
              href={row.news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline"
            >
              {row.news.publisher || "Source"} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttentionScoreDialog({
  open, onOpenChange, tickers, label,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tickers: string[];
  label?: string;
}) {
  const [data, setData] = useState<AttentionPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuiet, setShowQuiet] = useState(false);

  const unique = Array.from(new Set(tickers));
  const cacheKey = `attention-score:${[...unique].sort().join(",")}`;

  const run = async (force = false) => {
    if (unique.length === 0) { setError("No stocks to evaluate."); return; }
    setLoading(true); setError(null);
    try {
      if (!force) {
        const cached = await loadFromCache<AttentionPayload>(cacheKey, TTL);
        if (cached) { setData(cached); setLoading(false); return; }
      }
      const { data: res, error: err } = await supabase.functions.invoke("attention-score", {
        body: { tickers: unique },
      });
      if (err) throw err;
      if (res?.error) throw new Error(res.error);
      setData(res as AttentionPayload);
      saveLocalCache(cacheKey, res, TTL);
    } catch (e) {
      setError((e as Error).message || "Could not build the attention score.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cacheKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-wide flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" /> Attention Score{label ? ` — ${label}` : ""}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ranks {unique.length} stock{unique.length === 1 ? "" : "s"} by unusual moves, earnings and event dates,
            fresh news, analyst changes, volume spikes, technical breaks and fundamentals shifts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Updated {new Date(data.generatedAt).toLocaleString()}
            </span>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs ml-auto" onClick={() => run(true)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loading && !data && (
          <div className="text-center text-muted-foreground py-10 font-mono text-xs">Scoring {unique.length} stocks…</div>
        )}
        {error && !loading && (
          <div className="text-center text-destructive py-8 font-mono text-xs">{error}</div>
        )}

        {data && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h4 className="font-serif text-sm text-foreground flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" /> Needs your attention
                <span className="text-[10px] font-mono text-muted-foreground">({data.attention.length})</span>
              </h4>
              {data.attention.length === 0
                ? <p className="text-xs font-mono text-muted-foreground">Nothing urgent right now.</p>
                : data.attention.map((r) => <RowCard key={r.ticker} row={r} />)}
            </section>

            <section className="space-y-2">
              <h4 className="font-serif text-sm text-foreground flex items-center gap-2">
                <Eye className="h-4 w-4 text-gold-leaf" /> Worth watching
                <span className="text-[10px] font-mono text-muted-foreground">({data.watch.length})</span>
              </h4>
              {data.watch.length === 0
                ? <p className="text-xs font-mono text-muted-foreground">Nothing in the middle bucket.</p>
                : data.watch.map((r) => <RowCard key={r.ticker} row={r} />)}
            </section>

            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setShowQuiet((v) => !v)}
                className="font-serif text-sm text-foreground flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Moon className="h-4 w-4 text-muted-foreground" /> Nothing material
                <span className="text-[10px] font-mono text-muted-foreground">({data.quiet.length})</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showQuiet ? "rotate-180" : ""}`} />
              </button>
              {!showQuiet ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.quiet.map((r) => (
                    <Badge key={r.ticker} variant="secondary" className="font-mono text-[10px]">{r.ticker}</Badge>
                  ))}
                </div>
              ) : (
                data.quiet.map((r) => <RowCard key={r.ticker} row={r} dense />)
              )}
            </section>

            {data.skipped.length > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground">
                No market data for: {data.skipped.join(", ")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
