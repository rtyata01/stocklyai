// Calls the Lovable AI gateway with exponential backoff on 429/5xx responses.
export async function aiFetch(body: unknown, apiKey: string, retries = 3): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok || (res.status !== 429 && res.status < 500)) return res;
    last = res;
    if (attempt === retries) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 8000)
      : Math.min(800 * 2 ** attempt, 8000) + Math.random() * 300;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return last!;
}
