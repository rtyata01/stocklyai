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
import PortfolioSummaryDialog from "@/components/PortfolioSummaryDialog";
import PortfolioBriefingDialog from "@/components/PortfolioBriefingDialog";
import { SectorGroup } from "@/data/stocks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, Activity, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const queryClient = useQueryClient();
  const { ownerKey, isAuthed } = useAuth();
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [activeSectors, setActiveSectors] = useState<SectorGroup[]>(() => getWatchlistSectors(ownerKey));

  // Reload portfolio when the owner identity changes (sign in/out).
  useEffect(() => {
    setActiveSectors(getWatchlistSectors(ownerKey));
    queryClient.invalidateQueries({ queryKey: ["stock-quotes"] });
    queryClient.invalidateQueries({ queryKey: ["price-evaluations"] });
  }, [ownerKey, queryClient]);

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

          <ManageWatchlistDialog
            open={watchlistOpen}
            onOpenChange={setWatchlistOpen}
            onSave={handleWatchlistSave}
            ownerKey={ownerKey}
          />

          <PortfolioSummaryDialog open={summaryOpen} onOpenChange={setSummaryOpen} sectors={activeSectors} />
          <PortfolioBriefingDialog open={briefingOpen} onOpenChange={setBriefingOpen} sectors={activeSectors} />

          <main className="px-4 md:px-8 pt-4">
            <Tabs value={tab} onValueChange={handleTabChange}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                <TabsTrigger value="mylists" className="text-xs font-mono">My Watchlist</TabsTrigger>
                <TabsTrigger value="portfolio" className="text-xs font-mono">Portfolio</TabsTrigger>
                <TabsTrigger value="basics" className="text-xs font-mono">Trading 101</TabsTrigger>
                <TabsTrigger value="compare" className="text-xs font-mono">AI Compare</TabsTrigger>
                <TabsTrigger value="earnings" className="text-xs font-mono">Earnings Momentum</TabsTrigger>
                <TabsTrigger value="swing" className="text-xs font-mono">Swing Trading</TabsTrigger>
                <TabsTrigger value="cycle" className="text-xs font-mono">Cycle Trading</TabsTrigger>
                <TabsTrigger value="announcements" className="text-xs font-mono">Announcements</TabsTrigger>
                              </TabsList>

              <TabsContent value="mylists">
                <MyWatchlistPanel />
              </TabsContent>

              <TabsContent value="portfolio">
                {!isAuthed && (
                  <div className="mb-3 text-[11px] font-mono text-muted-foreground bg-secondary/40 border border-border rounded-sm px-3 py-2">
                    Signed in as guest — portfolio is saved on this device. <a href="/auth" className="text-primary underline underline-offset-2">Sign in</a> to sync across devices.
                  </div>
                )}
                <PortfolioTable
                  key={ownerKey}
                  sectors={activeSectors}
                  toolbarExtras={
                    <>
                      <Button variant="default" size="sm" onClick={() => setSummaryOpen(true)} className="gap-1.5 text-xs">
                        <Activity className="h-3.5 w-3.5" />
                        Portfolio Pulse
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setBriefingOpen(true)} className="gap-1.5 text-xs">
                        <Newspaper className="h-3.5 w-3.5" />
                        Weekly Debrief
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setWatchlistOpen(true)} className="gap-1.5 text-xs">
                        <Settings className="h-3.5 w-3.5" />
                        Manage Portfolio
                      </Button>
                    </>
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
