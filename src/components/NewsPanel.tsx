import { useState } from "react";
import { useStockNews, useRefreshNews, StockNewsItem } from "@/hooks/useStockNews";
import { RefreshCw, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { sectors } from "@/data/stocks";

const NewsPanel = () => {
  const { data: news, isLoading } = useStockNews();
  const refreshNews = useRefreshNews();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "fda">("all");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNews();
      await queryClient.invalidateQueries({ queryKey: ["stock-news"] });
    } catch (e) {
      console.error("Failed to refresh news:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const sectorMap = new Map<string, string>();
  sectors.forEach(s => s.tickers.forEach(t => sectorMap.set(t, s.name)));

  const filtered = (news ?? []).filter(n => filter === "all" || n.is_fda_related);

  const fdaCount = (news ?? []).filter(n => n.is_fda_related).length;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setFilter("all")}
          >
            All News ({(news ?? []).length})
          </Button>
          <Button
            variant={filter === "fda" ? "default" : "outline"}
            size="sm"
            className="text-xs gap-1"
            onClick={() => setFilter("fda")}
          >
            <AlertTriangle className="h-3 w-3" />
            FDA ({fdaCount})
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Fetch Latest
        </Button>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground py-20 font-mono text-sm">
          Loading announcements…
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-20 font-mono text-sm">
          No news available. Click "Fetch Latest" to scrape recent headlines.
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`border rounded-sm p-4 ${
              item.is_fda_related
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {item.ticker}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {sectorMap.get(item.ticker) || "Other"}
                  </span>
                  {item.is_fda_related && (
                    <Badge className="bg-primary/20 text-primary text-[10px] gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      FDA
                    </Badge>
                  )}
                </div>
                <h3 className="font-serif text-sm font-medium text-foreground leading-tight">
                  {item.headline}
                </h3>
                {item.summary && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {item.summary}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono shrink-0">
                <Clock className="h-3 w-3" />
                {formatDate(item.published_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsPanel;
