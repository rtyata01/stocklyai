import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(255);
export const alertSchema = z.object({ ticker: z.string().regex(/^[A-Z0-9][A-Z0-9.^=-]{0,14}$/, 'Choose a ticker.'), direction: z.enum(['above', 'below']), price: z.number().positive('Enter a price greater than zero.').max(10000000) });
export interface EmailPreference { token: string; email: string; subscribed: boolean }
export interface PriceAlert { id: string; ticker: string; direction: 'above' | 'below'; target_price: number; triggered_at: string | null }
const KEY = 'stockly-email-preferences-v1';
export function readEmailPreference(): EmailPreference | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return value && z.string().uuid().safeParse(value.token).success && emailSchema.safeParse(value.email).success ? value : null;
  } catch { return null; }
}
export function saveEmailPreference(value: EmailPreference) {
  localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new Event('stockly-email-updated'));
}
export async function emailRequest(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('email-preferences', { body });
  if (error) {
    const response = 'context' in error ? error.context : null;
    if (response instanceof Response) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.error ?? 'Could not save. Please try again.');
    }
    throw new Error('Could not connect. Please try again.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}