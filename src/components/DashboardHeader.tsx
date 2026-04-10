interface DashboardHeaderProps {
  totalStocks: number;
}

const DashboardHeader = ({ totalStocks }: DashboardHeaderProps) => {
  return (
    <header className="relative z-10 px-6 md:px-10 pt-8 md:pt-10 pb-6 md:pb-8 border-b border-border flex flex-col md:flex-row justify-between md:items-end gap-4 bg-gradient-to-b from-secondary/30 to-transparent">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight text-foreground">
          Vanguard Strategic Holdings
        </h1>
        <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground uppercase tracking-widest mt-2">
          <span>Dossier ID: 884-A</span>
          <span className="w-1 h-1 bg-border rounded-full hidden md:block" />
          <span className="hidden md:inline">Q1 2026 Allocation Review</span>
          <span className="w-1 h-1 bg-border rounded-full hidden md:block" />
          <span className="text-primary hidden md:inline">Confidential</span>
        </div>
      </div>
      <div className="md:text-right">
        <div className="font-mono text-lg md:text-2xl text-foreground tabular-nums">
          {totalStocks} Tracked Assets
        </div>
        <div className="text-xs text-muted-foreground mt-1">Active Monitoring</div>
      </div>
    </header>
  );
};

export default DashboardHeader;
