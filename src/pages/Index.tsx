import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import NewsPanel from "@/components/NewsPanel";
import SwingTradingPanel from "@/components/SwingTradingPanel";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";
import InvestingBasicsPanel from "@/components/InvestingBasicsPanel";
import StockComparisonPanel from "@/components/StockComparisonPanel";
import CycleTradingPanel from "@/components/CycleTradingPanel";
import ManageWatchlistDialog from "@/components/ManageWatchlistDialog";
import { usePortfolio } from "@/hooks/usePortfolio";
import PortfolioTable from "@/components/PortfolioTable";
import MyWatchlistPanel from "@/components/MyWatchlistPanel";
import MarketWatchlistPanel from "@/components/MarketWatchlistPanel";
import MarketLeadersPanel from "@/components/MarketLeadersPanel";


import PortfolioSummaryDialog from "@/components/PortfolioSummaryDialog";
import WeeklyDebriefButton from "@/components/WeeklyDebriefButton";
import AttentionScoreDialog from "@/components/AttentionScoreDialog";
import { SectorGroup } from "@/data/stocks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { Settings, Activity, Check, ChevronDown, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import SiteFooter from "@/components/SiteFooter";

const TRADING_TABS = [
  { value: "basics", label: "Trading 101", description: "Learn essential investing terms and principles." },
  { value: "cycle", label: "Cycle Trading", description: "Find stocks positioned for recurring market cycles." },
  { value: "swing", label: "Swing Trading", description: "Review short-term catalysts and trading signals." },
  { value: "earnings", label: "Earnings Momentum", description: "Discover upcoming earnings setups with favorable risk and reward." },
];

const WATCHLIST_TABS = [
  { value: "mylists", label: "My Watchlist", description: "Track your own custom stock lists, news, and attention signals." },
  { value: "market", label: "Market Watchlist", description: "Find the best stocks by sector and ranking across the market." },
  { value: "leaders", label: "Market Leaders", description: "See the top holdings of leading investors, and add your own." },
];



const MenuTooltip = ({ children, description }: { children: React.ReactNode; description: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom" className="max-w-64 text-xs">
      {description}
    </TooltipContent>
  </Tooltip>
);

const Index = () => {
  const queryClient = useQueryClient();
  const { ownerKey, isAuthed } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ["mylists", "market", "leaders", "portfolio", "compare", "earnings", "swing", "cycle", "announcements", "basics"];
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return t && VALID_TABS.includes(t) ? t : "portfolio";
  })();
  const [tab, setTab] = useState<string>(initialTab);
  const selectedTradingTab = TRADING_TABS.find((item) => item.value === tab);
  const selectedWatchlistTab = WATCHLIST_TABS.find((item) => item.value === tab);

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
  const [attentionOpen, setAttentionOpen] = useState(false);
  const { sectors: activeSectors, save: savePortfolio } = usePortfolio();

  // Refresh market data when the owner identity changes (sign in/out).
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["stock-quotes"] });
    queryClient.invalidateQueries({ queryKey: ["price-evaluations"] });
  }, [ownerKey, queryClient]);

  const handleWatchlistSave = (newSectors: SectorGroup[]) => {
    void savePortfolio(newSectors);
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
          <AttentionScoreDialog
            open={attentionOpen}
            onOpenChange={setAttentionOpen}
            tickers={activeSectors.flatMap((s) => s.tickers)}
            label="Portfolio"
          />

          <main className="px-4 md:px-8 pt-4">
            <Tabs value={tab} onValueChange={handleTabChange}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                <DropdownMenu>
                  <MenuTooltip description="Track your own lists or explore the wider market by sector and ranking.">
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 gap-1 px-3 text-xs font-mono font-medium ${selectedWatchlistTab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                        aria-label="Choose a watchlist view"
                      >
                        Watchlist
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                  </MenuTooltip>
                  <DropdownMenuContent align="start" className="w-72">
                    {WATCHLIST_TABS.map((item) => (
                      <DropdownMenuItem
                        key={item.value}
                        onSelect={() => handleTabChange(item.value)}
                        className="items-start gap-2 py-2.5"
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                          {tab === item.value && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        </span>
                        <span>
                          <span className="block text-xs font-mono font-medium">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{item.description}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <MenuTooltip description="Monitor your holdings, valuation levels, volume, and portfolio health.">
                  <TabsTrigger value="portfolio" className="text-xs font-mono">Portfolio</TabsTrigger>
                </MenuTooltip>

                <DropdownMenu>
                  <MenuTooltip description="Learn investing basics or explore cycle, swing, and earnings strategies.">
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 gap-1 px-3 text-xs font-mono font-medium ${selectedTradingTab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                        aria-label="Choose a trading strategy"
                      >
                        Trading
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                  </MenuTooltip>
                  <DropdownMenuContent align="start" className="w-72">
                    {TRADING_TABS.map((item) => (
                      <DropdownMenuItem
                        key={item.value}
                        onSelect={() => handleTabChange(item.value)}
                        className="items-start gap-2 py-2.5"
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                          {tab === item.value && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        </span>
                        <span>
                          <span className="block text-xs font-mono font-medium">{item.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{item.description}</span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <MenuTooltip description="Compare stocks using growth, margins, valuation, performance, and market peers.">
                  <TabsTrigger value="compare" className="text-xs font-mono">AI Compare</TabsTrigger>
                </MenuTooltip>
                <MenuTooltip description="Review breaking company developments and their potential market impact.">
                  <TabsTrigger value="announcements" className="text-xs font-mono">Announcements</TabsTrigger>
                </MenuTooltip>
              </TabsList>

              <TabsContent value="mylists">
                <MyWatchlistPanel />
              </TabsContent>

              <TabsContent value="market">
                <MarketWatchlistPanel />
              </TabsContent>

              <TabsContent value="leaders">
                <MarketLeadersPanel />
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
                  onReorderSectors={(next) => { void savePortfolio(next); }}
                  toolbarExtras={
                    <>
                      <Button variant="default" size="sm" onClick={() => setAttentionOpen(true)} className="gap-1.5 text-xs">
                        <Flame className="h-3.5 w-3.5" />
                        Attention Score
                      </Button>
                      <WeeklyDebriefButton sectors={activeSectors} label="Portfolio" />
                      <Button variant="default" size="sm" onClick={() => setSummaryOpen(true)} className="gap-1.5 text-xs">
                        <Activity className="h-3.5 w-3.5" />
                        Portfolio Pulse
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

          <SiteFooter />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Index;
