import { escapeHtml } from './emailRules.ts';

export const deliveryReady = () => Boolean(Deno.env.get('EMAIL_FROM') && Deno.env.get('RESEND_API_KEY') && Deno.env.get('LOVABLE_API_KEY'));
export function emailFooter(token: string): string {
  const link = `https://stocklyai.lovable.app/email/unsubscribe?token=${encodeURIComponent(token)}`;
  return `<hr><p>Market data: Yahoo Finance. Informational only — not financial advice.</p><p><a href="${escapeHtml(link)}">Unsubscribe from debriefs and price alerts</a></p>`;
}
export async function sendEmail(email: string, subject: string, html: string, token: string, idempotencyKey: string) {
  if (!deliveryReady()) throw new Error('Sender verification required');
  const unsubscribe = `https://stocklyai.lovable.app/email/unsubscribe?token=${encodeURIComponent(token)}`;
  const response = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'X-Connection-Api-Key': Deno.env.get('RESEND_API_KEY') ?? '', 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM'), reply_to: 'tyataessence@gmail.com', to: [email], subject, html: `<html><body><h1>STOCKLYAI</h1>${html}${emailFooter(token)}</body></html>`, headers: { 'List-Unsubscribe': `<${unsubscribe}>` } }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Resend failed', response.status, detail);
    throw new Error(`Email delivery failed (${response.status})`);
  }
  const result = await response.json();
  if (!result.id) throw new Error('Email delivery was not accepted');
  return result.id;
}