import { describe, expect, it } from 'vitest';
import { extractReportedFundamentals, trailingValue } from '../../supabase/functions/_shared/reportedFundamentals';

const records = [
  { start: '2025-01-01', end: '2025-12-31', val: 400, form: '10-K', filed: '2026-02-01' },
  { start: '2025-01-01', end: '2025-06-30', val: 180, form: '10-Q', filed: '2025-07-20' },
  { start: '2026-01-01', end: '2026-06-30', val: 230, form: '10-Q', filed: '2026-07-20' },
];
describe('Reported fundamentals', () => {
  it('uses annual plus current YTD minus matching prior YTD', () => {
    expect(trailingValue(records, '2026-10-09')).toEqual({ value: 450, end: '2026-06-30' });
  });
  it('ignores future reports and does not treat quarter values as annual', () => {
    expect(trailingValue(records, '2026-03-01')).toEqual({ value: 400, end: '2025-12-31' });
    expect(trailingValue([records[2]], '2026-10-09')).toBeNull();
  });
  it('preserves zero cash flow and derives P/E from positive reported EPS', () => {
    const fact = (val: number) => ({ units: { USD: [{ ...records[0], val }] } });
    const result = extractReportedFundamentals({ facts: { 'us-gaap': {
      Revenues: fact(400000000),
      NetCashProvidedByUsedInOperatingActivities: fact(50000000),
      PaymentsToAcquirePropertyPlantAndEquipment: fact(50000000),
      EarningsPerShareDiluted: { units: { 'USD/shares': [{ ...records[0], val: 10 }] } },
    } } }, 200);
    expect(result.freeCashFlow).toBe(0);
    expect(result.totalRevenue).toBe(400);
    expect(result.peRatio).toBe(20);
    expect(result.marketCap).toBeNull();
  });
});