import { useState } from "react";
import { stocks, StockCategory } from "@/data/stocks";
import StockCard from "@/components/StockCard";
import DashboardHeader from "@/components/DashboardHeader";

const Index = () => {
  const [activeTab, setActiveTab] = useState<StockCategory>("high-risk");

  const filteredStocks = stocks.filter((s) => s.category === activeTab);

  const tabs: { key: StockCategory; label: string; sublabel: string }[] = [
    { key: "high-risk", label: "Strategic Allocation", sublabel: "GROWTH / RISK" },
    { key: "low-risk", label: "Core Holdings", sublabel: "STABLE" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto bg-card border-x border-border shadow-2xl min-h-screen">
        {/* Warm spotlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[100px] pointer-events-none rounded-full" />

        <DashboardHeader totalStocks={stocks.length} />

        {/* Tabs */}
        <nav className="px-6 md:px-10 flex gap-1 border-b border-border bg-background/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 md:px-6 py-4 text-sm font-medium tracking-wide transition-colors relative ${
                activeTab === tab.key
                  ? "text-primary bg-card border-x border-t border-border -mb-px"
                  : "text-muted-foreground hover:text-foreground border-x border-t border-transparent"
              }`}
            >
              {tab.label}
              <span className="text-[10px] font-mono ml-2 opacity-70">{tab.sublabel}</span>
            </button>
          ))}
        </nav>

        {/* Stock Grid */}
        <main className="p-6 md:p-10 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredStocks.map((stock) => (
              <StockCard key={stock.ticker} stock={stock} />
            ))}
          </div>

          {filteredStocks.length === 0 && (
            <div className="text-center text-muted-foreground py-20 font-mono text-sm">
              No stocks in this category.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
