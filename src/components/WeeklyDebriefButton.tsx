import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Newspaper } from "lucide-react";
import PortfolioBriefingDialog from "@/components/PortfolioBriefingDialog";
import { SectorGroup } from "@/data/stocks";

interface WeeklyDebriefButtonProps {
  /** Holdings to brief on. */
  sectors: SectorGroup[];
  /** Name shown in the dialog header (e.g. "Portfolio" or a watchlist name). */
  label?: string;
  variant?: "default" | "secondary" | "outline";
  className?: string;
}

/**
 * Self-contained "Weekly Debrief" control: button + briefing dialog.
 * Reusable across Portfolio, My Watchlist, and any future holdings view.
 */
export default function WeeklyDebriefButton({
  sectors,
  label = "Portfolio",
  variant = "secondary",
  className = "gap-1.5 text-xs",
}: WeeklyDebriefButtonProps) {
  const [open, setOpen] = useState(false);
  const disabled = sectors.every((s) => s.tickers.length === 0);

  return (
    <>
      <Button variant={variant} size="sm" className={className} onClick={() => setOpen(true)} disabled={disabled}>
        <Newspaper className="h-3.5 w-3.5" />
        Weekly Debrief
      </Button>
      <PortfolioBriefingDialog open={open} onOpenChange={setOpen} sectors={sectors} label={label} />
    </>
  );
}
