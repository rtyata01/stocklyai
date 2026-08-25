import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Search } from "lucide-react";

export interface NewsSource {
  title: string;
  url: string;
  publisher?: string;
  publishedAt?: string | null;
}

export interface NewsAlert {
  ticker?: string;
  title: string;
  note?: string;
  details?: string;
  keyPoints?: string[];
  impact?: "bullish" | "bearish" | "neutral";
  type: "alert" | "buy" | "sell" | "watch";
  price?: number;
  createdAt?: string;
  sources?: NewsSource[];
}

const TYPE_COLORS: Record<NewsAlert["type"], string> = {
  alert: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  buy: "bg-pine/10 text-pine border-pine/30",
  sell: "bg-destructive/10 text-destructive border-destructive/30",
  watch: "bg-primary/10 text-primary border-primary/30",
};

const IMPACT_COLORS: Record<NonNullable<NewsAlert["impact"]>, string> = {
  bullish: "bg-pine/10 text-pine border-pine/30",
  bearish: "bg-destructive/10 text-destructive border-destructive/30",
  neutral: "bg-secondary text-muted-foreground border-border",
};

export default function NewsDetailDialog({
  alert, open, onOpenChange,
}: {
  alert: NewsAlert | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!alert) return null;
  const sources = alert.sources ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={`text-[10px] font-mono uppercase ${TYPE_COLORS[alert.type]}`}>{alert.type}</Badge>
            {alert.ticker && <Badge className="bg-primary text-primary-foreground font-mono text-[10px] px-2">{alert.ticker}</Badge>}
            {alert.impact && (
              <Badge variant="outline" className={`text-[10px] font-mono uppercase ${IMPACT_COLORS[alert.impact]}`}>{alert.impact}</Badge>
            )}
            {typeof alert.price === "number" && alert.price > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground">${alert.price.toFixed(2)}</span>
            )}
          </div>
          <DialogTitle className="font-serif text-left text-base leading-snug">{alert.title}</DialogTitle>
          {alert.createdAt && (
            <DialogDescription className="font-mono text-[10px]">
              {new Date(alert.createdAt).toLocaleString()}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {alert.note && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Summary</div>
              <p className="text-sm text-foreground leading-relaxed">{alert.note}</p>
            </div>
          )}

          {alert.details && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Full Context</div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{alert.details}</p>
            </div>
          )}

          {alert.keyPoints && alert.keyPoints.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Key Points</div>
              <ul className="space-y-1">
                {alert.keyPoints.map((k, i) => (
                  <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
                    <span className="text-primary">•</span><span>{k}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Related News</div>
            {sources.length > 0 ? (
              <div className="space-y-2">
                {sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-border rounded-sm p-2.5 bg-secondary/20 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <div className="text-sm text-foreground leading-snug">{s.title}</div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          {s.publisher ?? "News"}
                          {s.publishedAt ? ` · ${new Date(s.publishedAt).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No linked articles were returned for this alert.</p>
            )}
          </div>

          {alert.ticker && (
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={`https://finance.yahoo.com/quote/${encodeURIComponent(alert.ticker)}/news`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono inline-flex items-center gap-1.5 border border-border rounded-sm px-2.5 py-1.5 hover:bg-secondary transition-colors"
              >
                <Search className="h-3 w-3" /> Yahoo Finance news
              </a>
              <a
                href={`https://news.google.com/search?q=${encodeURIComponent(alert.ticker + " stock")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono inline-flex items-center gap-1.5 border border-border rounded-sm px-2.5 py-1.5 hover:bg-secondary transition-colors"
              >
                <Search className="h-3 w-3" /> Google News
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
