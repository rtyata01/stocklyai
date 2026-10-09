type Fact = { start?: string; end: string; val: number; filed?: string; form?: string };
const days = (f: Fact) => f.start ? (Date.parse(f.end) - Date.parse(f.start)) / 86400000 + 1 : 0;
export function trailingValue(rows: Fact[], today = new Date().toISOString().slice(0, 10)): { value: number; end: string } | null {
  const valid = rows.filter(f => f.start && f.end <= today && (!f.filed || f.filed <= today) && Number.isFinite(f.val) && ['10-K', '10-Q', '20-F', '40-F'].includes(f.form ?? '')).sort((a, b) => b.end.localeCompare(a.end) || (b.filed ?? '').localeCompare(a.filed ?? ''));
  const annual = valid.find(f => days(f) >= 350 && days(f) <= 380);
  if (!annual) return null;
  const ytd = valid.find(f => f.end > annual.end && days(f) >= 60 && days(f) < 350 && f.start && new Date(f.start).getUTCFullYear() === new Date(f.end).getUTCFullYear());
  if (!ytd) return { value: annual.val, end: annual.end };
  const prior = valid.find(f => new Date(f.end).getUTCFullYear() === new Date(ytd.end).getUTCFullYear() - 1 && f.end.slice(5) === ytd.end.slice(5) && Math.abs(days(f) - days(ytd)) <= 3);
  return prior ? { value: annual.val + ytd.val - prior.val, end: ytd.end } : { value: annual.val, end: annual.end };
}
export function extractReportedFundamentals(data: any, price: number) {
  const facts = data?.facts?.['us-gaap'] ?? {};
  const rows = (names: string[], unit: string): Fact[] => names.flatMap(name => facts[name]?.units?.[unit] ?? []);
  const revenue = trailingValue(rows(['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet'], 'USD'));
  const eps = trailingValue(rows(['EarningsPerShareDiluted'], 'USD/shares'));
  const operating = trailingValue(rows(['NetCashProvidedByUsedInOperatingActivities'], 'USD'));
  const capex = trailingValue(rows(['PaymentsToAcquirePropertyPlantAndEquipment'], 'USD'));
  const today = new Date().toISOString().slice(0, 10);
  const shares = rows(['CommonStockSharesOutstanding'], 'shares').filter(f => f.end <= today && (!f.filed || f.filed <= today) && f.val > 0).sort((a, b) => b.end.localeCompare(a.end) || (b.filed ?? '').localeCompare(a.filed ?? ''))[0];
  return {
    totalRevenue: revenue ? revenue.value / 1e6 : null,
    eps: eps?.value ?? null,
    peRatio: eps && eps.value > 0 && price > 0 ? price / eps.value : null,
    freeCashFlow: operating && capex && operating.end === capex.end ? (operating.value - capex.value) / 1e6 : null,
    marketCap: shares && price > 0 ? shares.val * price / 1e9 : null,
    reportingDate: revenue?.end ?? eps?.end ?? null,
  };
}