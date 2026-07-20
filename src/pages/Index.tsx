import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import NewsPanel from "@/components/NewsPanel";
import SwingTradingPanel from "@/components/SwingTradingPanel";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import InvestingBasicsPanel from "@/components/InvestingBasicsPanel";
import StockComparisonPanel from "@/components/StockComparisonPanel";
import CycleTradingPanel from "@/components/CycleTradingPanel";
import ManageWatchlistDialog, { getWatchlistSectors } from "@/components/ManageWatchlistDialog";
import PortfolioTable from "@/components/PortfolioTable";
import MyWatchlistPanel from "@/components/MyWatchlistPanel";
import { SectorGroup } from "@/data/stocks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";

const SHOW_WATCHLIST = import.meta.env.DEV;

const Index = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ["mylists", "portfolio", "compare", "earnings", "swing", "cycle", "announcements", "basics"];
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return t && VALID_TABS.includes(t) ? t : "portfolio";
  })();
  const [tab, setTab] = useState<string>(initialTab);
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && VALID_TABS.includes(t) && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const handleTabChange = (v: string) => {
    setTab(v);
    const next = new URLSearchParams(searchParams);
    if (v === "portfolio") next.delete("tab"); else next.set("tab", v);
    setSearchParams(next, { replace: true });
  };
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [activeSectors, setActiveSectors] = useState<SectorGroup[]>(() => getWatchlistSectors());

  const handleWatchlistSave = (newSectors: SectorGroup[]) => {
    setActiveSectors(newSectors);
    queryClient.invalidateQueries({ queryKey: ["stock-quotes"] });
    queryClient.invalidateQueries({ queryKey: ["price-evaluations"] });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Helmet>
        <title>STOCKLYAI — Active Monitoring, AI-Powered Stock Portfolio &amp; Analytics</title>
        <meta name="description" content="Active monitoring and AI-powered stock portfolio analytics with buy/hold/sell zones, earnings momentum picks, and side-by-side AI stock comparisons." />
        <link rel="canonical" href="https://stocklyai.lovable.app/" />
        <meta property="og:title" content="STOCKLYAI — Active Monitoring, AI-Powered Stock Portfolio &amp; Analytics" />
        <meta property="og:description" content="Active monitoring and AI-powered stock portfolio analytics with buy/hold/sell zones, earnings momentum picks, and side-by-side AI stock comparisons." />
        <meta property="og:url" content="https://stocklyai.lovable.app/" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="max-w-[1400px] mx-auto bg-card border-x border-border shadow-2xl min-h-screen">
          <DashboardHeader />

          {SHOW_WATCHLIST && (
            <ManageWatchlistDialog
              open={watchlistOpen}
              onOpenChange={setWatchlistOpen}
              onSave={handleWatchlistSave}
            />
          )}

          <main className="px-4 md:px-8 pt-4">
            <Tabs value={tab} onValueChange={handleTabChange}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                <TabsTrigger value="mylists" className="text-xs font-mono">My Watchlist</TabsTrigger>
                <TabsTrigger value="portfolio" className="text-xs font-mono">Portfolio</TabsTrigger>
                <TabsTrigger value="compare" className="text-xs font-mono">AI Compare</TabsTrigger>
                <TabsTrigger value="earnings" className="text-xs font-mono">Earnings Momentum</TabsTrigger>
                <TabsTrigger value="swing" className="text-xs font-mono">Swing Trading</TabsTrigger>
                <TabsTrigger value="cycle" className="text-xs font-mono">Cycle Trading</TabsTrigger>
                <TabsTrigger value="announcements" className="text-xs font-mono">Announcements</TabsTrigger>
                <TabsTrigger value="basics" className="text-xs font-mono">Investing 101</TabsTrigger>
              </TabsList>

              <TabsContent value="mylists">
                <MyWatchlistPanel />
              </TabsContent>

              <TabsContent value="portfolio">
                <PortfolioTable
                  sectors={activeSectors}
                  toolbarExtras={
                    SHOW_WATCHLIST ? (
                      <Button variant="outline" size="sm" onClick={() => setWatchlistOpen(true)} className="gap-1.5 text-xs">
                        <Settings className="h-3.5 w-3.5" />
                        Manage Watchlist
                      </Button>
                    ) : null
                  }
                />
              </TabsContent>

              <TabsContent value="compare">
                <div className="pb-8"><StockComparisonPanel /></div>
              </TabsContent>

              <TabsContent value="earnings">
                <div className="pb-8"><NewsPanel /></div>
              </TabsContent>

              <TabsContent value="swing">
                <div className="pb-8"><SwingTradingPanel /></div>
              </TabsContent>

              <TabsContent value="cycle">
                <div className="pb-8"><CycleTradingPanel /></div>
              </TabsContent>

              <TabsContent value="announcements">
                <div className="pb-8"><AnnouncementsPanel /></div>
              </TabsContent>

              <TabsContent value="basics">
                <div className="pb-8"><InvestingBasicsPanel /></div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Index;
