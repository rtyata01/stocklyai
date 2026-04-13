import { RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  totalStocks: number;
  onRefresh?: () => void;
  onManageStocks?: () => void;
  isRefreshing?: boolean;
}

const DashboardHeader = ({ totalStocks, onRefresh, onManageStocks, isRefreshing }: DashboardHeaderProps) => {
  return (
    <header className="relative z-10 px-6 md:px-10 pt-8 md:pt-10 pb-6 md:pb-8 border-b border-border flex flex-col md:flex-row justify-between md:items-end gap-4 bg-gradient-to-b from-secondary/30 to-transparent">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          STOCKLY.AI
        </h1>
        <div className="font-mono text-xs text-muted-foreground mt-1">
          {totalStocks} Tracked Assets · Active Monitoring
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onManageStocks} className="gap-1.5 text-xs">
          <Settings className="h-3.5 w-3.5" />
          Manage Watchlist
        </Button>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Re-evaluate
        </Button>
      </div>
    </header>
  );
};

export default DashboardHeader;
