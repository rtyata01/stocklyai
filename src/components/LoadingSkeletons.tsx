import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

/** Pulsing placeholder rows that mimic a stock table. */
export function TableSkeleton({ rows = 6, sections = 1 }: { rows?: number; sections?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <span className="flex-1 h-[1px] bg-border" />
          </div>
          <div className="border border-border rounded-sm divide-y divide-border">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="grid grid-cols-[14%_16%_14%_1fr_1fr_1fr_8%] gap-3 items-center px-3 py-3">
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-16 hidden md:block" />
                <Skeleton className="h-3.5 w-16 hidden md:block" />
                <Skeleton className="h-3.5 w-16 hidden md:block" />
                <Skeleton className="h-3.5 w-10" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Pulsing placeholder cards (news, signals, metrics). */
export function CardSkeleton({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`grid gap-3 ${className}`} aria-busy="true" aria-label="Loading data">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-border rounded-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

/** Small inline badge shown while cached values are being refreshed. */
export function UpdatingBadge({ label = "updating…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> {label}
    </span>
  );
}
