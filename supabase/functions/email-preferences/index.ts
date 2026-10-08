import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { emailSchema, tickerSchema, tokenSchema, marketPrice } from '../_shared/emailRules.ts';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('subscribe'), email: emailSchema, tickers: z.array(tickerSchema).min(1).max(100), label: z.string().trim().min(1).max(100), token: tokenSchema.optional() }),
  z.object({ action: z.literal('list'), token: tokenSchema }),
  z.object({ action: z.literal('save-alert'), token: tokenSchema.optional(), email: emailSchema.optional(), ticker: tickerSchema, direction: z.enum(['above', 'below']), price: z.number().positive().max(10000000) }),
  z.object({ action: z.literal('delete-alert'), token: tokenSchema, id: tokenSchema }),
  z.object({ action: z.literal('unsubscribe-status'), token: tokenSchema }),
  z.object({ action: z.literal('unsubscribe'), token: tokenSchema }),
]);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Please check your email, ticker and price.' }, 400);
    const body = parsed.data;
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    let subscription: any = null;
    if ('token' in body && body.token) {
      const result = await db.from('email_subscriptions').select('*').eq('management_token', body.token).maybeSingle();
      if (result.error) throw result.error;
      subscription = result.data;
      if (!subscription) return json({ error: 'This subscription link is invalid.' }, 404);
    }
    const createSubscription = async (email: string, subscribed: boolean, tickers: string[], label: string) => {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
      const requestHash = Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2, '0')).join('');
      const { count, error: countError } = await db.from('email_subscriptions').select('id', { count: 'exact', head: true }).eq('request_hash', requestHash).gte('created_at', new Date(Date.now() - 86400000).toISOString());
      if (countError) throw countError;
      if ((count ?? 0) >= 5) throw new Error('SUBSCRIPTION_LIMIT');
      const { data, error } = await db.from('email_subscriptions').insert({ email, subscribed, tickers, label, request_hash: requestHash }).select('*').single();
      if (error) throw error;
      return data;
    };
    if (body.action === 'subscribe') {
      if (subscription && subscription.email !== body.email) subscription = null;
      if (!subscription) subscription = await createSubscription(body.email, true, [...new Set(body.tickers)], body.label);
      else {
        const { error } = await db.from('email_subscriptions').update({ subscribed: true, tickers: [...new Set(body.tickers)], label: body.label }).eq('id', subscription.id);
        if (error) throw error;
      }
      return json({ token: subscription.management_token, email: subscription.email, subscribed: true, deliveryReady: Boolean(Deno.env.get('EMAIL_FROM')) });
    }
    if (body.action === 'save-alert') {
      if (!subscription) {
        if (!body.email) return json({ error: 'Enter an email for your price alert.' }, 400);
        subscription = await createSubscription(body.email, false, [], 'Price alerts');
      }
      const { count, error: countError } = await db.from('price_alerts').select('id', { count: 'exact', head: true }).eq('subscription_id', subscription.id).is('delivered_at', null);
      if (countError) throw countError;
      if ((count ?? 0) >= 20) return json({ error: 'You can have up to 20 active alerts.' }, 400);
      const baseline = await marketPrice(body.ticker);
      const { error } = await db.from('price_alerts').insert({ subscription_id: subscription.id, ticker: body.ticker, direction: body.direction, target_price: body.price, last_price: baseline });
      if (error) throw error;
    } else if (body.action === 'delete-alert') {
      const { error } = await db.from('price_alerts').delete().eq('id', body.id).eq('subscription_id', subscription.id);
      if (error) throw error;
    } else if (body.action === 'unsubscribe-status') {
      return json({ subscribed: subscription.subscribed });
    } else if (body.action === 'unsubscribe') {
      const { error } = await db.from('email_subscriptions').update({ subscribed: false }).eq('id', subscription.id);
      if (error) throw error;
      const { error: alertError } = await db.from('price_alerts').delete().eq('subscription_id', subscription.id).is('delivered_at', null);
      if (alertError) throw alertError;
      return json({ unsubscribed: true });
    }
    const { data: alerts, error } = await db.from('price_alerts').select('id,ticker,direction,target_price,triggered_at').eq('subscription_id', subscription.id).is('delivered_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    return json({ token: subscription.management_token, email: subscription.email, subscribed: subscription.subscribed, alerts, deliveryReady: Boolean(Deno.env.get('EMAIL_FROM')) });
  } catch (error) {
    if (error instanceof Error && error.message === 'SUBSCRIPTION_LIMIT') return json({ error: 'Too many subscriptions today. Please try tomorrow.' }, 429);
    console.error('email-preferences failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Could not save your email preferences. Please try again.' }, 500);
  }
});