import type { SectorGroup } from "@/data/stocks";

const HEADER = ["ticker", "sector", "shares", "date_exported"];

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Holdings → CSV. Shares are not tracked yet, so that column is left blank. */
export function portfolioToCsv(sectors: SectorGroup[], date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const rows = sectors.flatMap((s) => s.tickers.map((t) => [t, s.name, "", day].map(esc).join(",")));
  return [HEADER.join(","), ...rows].join("\n") + "\n";
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

/** CSV → sectors (keeps sector order of first appearance, dedupes tickers). Throws on bad files. */
export function csvToPortfolio(text: string): SectorGroup[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw new Error("The file is empty.");
  const head = splitLine(lines[0]).map((h) => h.toLowerCase());
  const ti = head.indexOf("ticker"), si = head.indexOf("sector");
  if (ti === -1 || si === -1) throw new Error("This file needs 'ticker' and 'sector' columns.");
  const map = new Map<string, string[]>();
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    const ticker = (cells[ti] ?? "").toUpperCase();
    const sector = cells[si] || "Other";
    if (!/^[A-Z0-9.\-^=]{1,15}$/.test(ticker)) continue;
    const list = map.get(sector) ?? [];
    if (!list.includes(ticker)) list.push(ticker);
    map.set(sector, list);
  }
  if (!map.size) throw new Error("No valid tickers found in this file.");
  return [...map].map(([name, tickers]) => ({ name, tickers }) as SectorGroup);
}
