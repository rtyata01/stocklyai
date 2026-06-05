import { Settings, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useVisitStats } from "@/hooks/useVisitStats";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DashboardHeaderProps {
  totalStocks: number;
  onManageStocks?: () => void;
}

const DashboardHeader = ({ totalStocks, onManageStocks }: DashboardHeaderProps) => {
  const stats = useVisitStats();
  return (
    <header className="relative z-10 px-6 md:px-10 pt-8 md:pt-10 pb-6 md:pb-8 border-b border-border flex flex-col md:flex-row justify-between md:items-end gap-4 bg-gradient-to-b from-secondary/30 to-transparent">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          STOCKLY.AI — AI-Powered Stock Portfolio &amp; Analytics
        </h1>
        <div className="font-mono text-xs text-muted-foreground mt-1">
          {totalStocks} Tracked Assets · Active Monitoring
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {onManageStocks && (
            <Button variant="outline" size="sm" onClick={onManageStocks} className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" />
              Manage Watchlist
            </Button>
          )}
          <ThemeSwitcher />
        </div>
        <div className="font-mono text-[11px] text-muted-foreground flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 cursor-help">
                <Users className="h-3 w-3" />
                {stats ? stats.unique.toLocaleString() : "—"} unique
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Distinct visitors to date</TooltipContent>
          </Tooltip>
          <span className="text-border">·</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 cursor-help">
                <Eye className="h-3 w-3" />
                {stats ? stats.total.toLocaleString() : "—"} total
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Total visits to date</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
