import { describe, expect, it } from 'vitest';
import { crosses } from '../../supabase/functions/_shared/priceCrossing';
import { alertSchema, emailSchema } from './emailPreferences';

describe('Price crossing alerts', () => {
  it('requires a previous observation and a true upward crossing', () => {
    expect(crosses(null, 110, 100, 'above')).toBe(false);
    expect(crosses(105, 110, 100, 'above')).toBe(false);
    expect(crosses(99, 100, 100, 'above')).toBe(false);
    expect(crosses(100, 101, 100, 'above')).toBe(true);
  });
  it('detects downward crossings without repeating', () => {
    expect(crosses(101, 99, 100, 'below')).toBe(true);
    expect(crosses(99, 98, 100, 'below')).toBe(false);
    expect(crosses(100, 99, 100, 'below')).toBe(true);
  });
  it('validates emails and rejects invalid prices and tickers', () => {
    expect(emailSchema.safeParse('subscriber@example.com').success).toBe(true);
    expect(emailSchema.safeParse('invalid').success).toBe(false);
    expect(alertSchema.safeParse({ ticker: 'AAPL', direction: 'above', price: 100 }).success).toBe(true);
    expect(alertSchema.safeParse({ ticker: '<script>', direction: 'above', price: 100 }).success).toBe(false);
    expect(alertSchema.safeParse({ ticker: 'AAPL', direction: 'below', price: -1 }).success).toBe(false);
  });
});