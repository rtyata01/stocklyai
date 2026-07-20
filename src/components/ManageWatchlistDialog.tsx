import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { sectors, SectorGroup } from "@/data/stocks";

const LEGACY_KEY = "stockly-watchlist";
const keyFor = (ownerKey?: string) =>
  ownerKey ? `stockly-portfolio:${ownerKey}` : LEGACY_KEY;

/**
 * Returns the user's saved portfolio merged with any new sectors/tickers added
 * to the default `sectors` list since they last saved. Scoped per owner
 * (guest visitor id or signed-in user id) so each identity has its own portfolio.
 */
export function getWatchlistSectors(ownerKey?: string): SectorGroup[] {
  try {
    let raw = localStorage.getItem(keyFor(ownerKey));
    // one-time migration from legacy shared key
    if (!raw && ownerKey) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        localStorage.setItem(keyFor(ownerKey), legacy);
        raw = legacy;
      }
    }
    if (!raw) return sectors;
    const stored: SectorGroup[] = JSON.parse(raw);
    const byName = new Map(stored.map((s) => [s.name, { ...s, tickers: [...s.tickers] }]));
    let changed = false;
    for (const def of sectors) {
      const existing = byName.get(def.name);
      if (!existing) {
        byName.set(def.name, { ...def, tickers: [...def.tickers] });
        changed = true;
      } else {
        for (const t of def.tickers) {
          if (!existing.tickers.includes(t)) {
            existing.tickers.push(t);
            changed = true;
          }
        }
      }
    }
    const merged = Array.from(byName.values());
    if (changed) {
      try { localStorage.setItem(keyFor(ownerKey), JSON.stringify(merged)); } catch { /* ignore */ }
    }
    return merged;
  } catch { /* fallback */ }
  return sectors;
}

export function saveWatchlistSectors(data: SectorGroup[], ownerKey?: string) {
  localStorage.setItem(keyFor(ownerKey), JSON.stringify(data));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (sectors: SectorGroup[]) => void;
  ownerKey?: string;
}

const ManageWatchlistDialog = ({ open, onOpenChange, onSave, ownerKey }: Props) => {
  const [editSectors, setEditSectors] = useState<SectorGroup[]>(() => getWatchlistSectors(ownerKey));
  const [newTicker, setNewTicker] = useState("");
  const [selectedSector, setSelectedSector] = useState(0);
  const [newSectorName, setNewSectorName] = useState("");

  // Refresh from storage when identity changes or dialog reopens
  useEffect(() => {
    if (open) setEditSectors(getWatchlistSectors(ownerKey));
  }, [open, ownerKey]);

  const handleAddTicker = () => {
    const t = newTicker.trim().toUpperCase();
    if (!t) return;
    const alreadyExists = editSectors.some(s => s.tickers.includes(t));
    if (alreadyExists) { setNewTicker(""); return; }
    setEditSectors(prev => prev.map((s, i) =>
      i === selectedSector ? { ...s, tickers: [...s.tickers, t] } : s
    ));
    setNewTicker("");
  };

  const handleRemoveTicker = (sectorIdx: number, ticker: string) => {
    setEditSectors(prev => prev.map((s, i) =>
      i === sectorIdx ? { ...s, tickers: s.tickers.filter(t => t !== ticker) } : s
    ).filter(s => s.tickers.length > 0));
  };

  const handleAddSector = () => {
    const name = newSectorName.trim();
    if (!name) return;
    if (editSectors.some(s => s.name.toLowerCase() === name.toLowerCase())) return;
    setEditSectors(prev => [...prev, { name, tickers: [] }]);
    setNewSectorName("");
    setSelectedSector(editSectors.length);
  };

  const handleRemoveSector = (idx: number) => {
    setEditSectors(prev => prev.filter((_, i) => i !== idx));
    if (selectedSector >= editSectors.length - 1) setSelectedSector(Math.max(0, editSectors.length - 2));
  };

  const handleSave = () => {
    const cleaned = editSectors.filter(s => s.tickers.length > 0);
    saveWatchlistSectors(cleaned, ownerKey);
    onSave(cleaned);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Manage Portfolio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add ticker */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Add Stock to Sector</label>
            <div className="flex gap-2">
              <select
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground"
                value={selectedSector}
                onChange={e => setSelectedSector(Number(e.target.value))}
              >
                {editSectors.map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
              <Input
                placeholder="TICKER"
                value={newTicker}
                onChange={e => setNewTicker(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddTicker()}
                className="w-28 font-mono uppercase"
              />
              <Button size="sm" onClick={handleAddTicker} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>

          {/* Add new sector */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Add New Sector</label>
            <div className="flex gap-2">
              <Input
                placeholder="Sector name"
                value={newSectorName}
                onChange={e => setNewSectorName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddSector()}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={handleAddSector} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Sector
              </Button>
            </div>
          </div>

          {/* Current sectors & tickers */}
          <div className="space-y-3">
            {editSectors.map((sector, si) => (
              <div key={si} className="border border-border rounded-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-serif text-sm font-medium text-foreground">{sector.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveSector(si)} className="h-6 px-2 text-destructive hover:text-destructive text-[10px]">
                    Remove Sector
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sector.tickers.map(t => (
                    <Badge key={t} variant="secondary" className="font-mono text-xs gap-1 pr-1">
                      {t}
                      <button onClick={() => handleRemoveTicker(si, t)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {sector.tickers.length === 0 && (
                    <span className="text-xs text-muted-foreground font-mono">No tickers — add one above or remove sector</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Portfolio</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageWatchlistDialog;
