const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SECTOR_UNIVERSE: Record<string, string[]> = {
  tech: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'ORCL', 'CRM', 'ADBE', 'NOW', 'SHOP', 'UBER', 'NFLX', 'IBM', 'SAP', 'SNOW', 'DDOG', 'PANW', 'CRWD', 'INTU', 'AVGO', 'TSM', 'QCOM', 'ARM', 'DELL', 'HPQ'],
  ai: ['NVDA', 'PLTR', 'AMD', 'SMCI', 'CRWV', 'NBIS', 'BBAI', 'APLD', 'AI', 'SOUN', 'MSFT', 'GOOGL', 'META', 'ORCL', 'TSM', 'MRVL', 'VRT', 'ANET', 'IONQ', 'DDOG', 'SNOW', 'TEM', 'INOD', 'CRDO', 'ALAB'],
  robotics: ['TSLA', 'ISRG', 'ABB', 'ROK', 'FANUY', 'IRBT', 'SERV', 'RR', 'PATH', 'NVDA', 'TER', 'OMCL', 'KRNT', 'CGNX', 'SYM', 'AVAV', 'KTOS', 'RKLB', 'HON', 'EMR'],
  energy: ['XOM', 'CVX', 'COP', 'SLB', 'OXY', 'PSX', 'MPC', 'VLO', 'EOG', 'DVN', 'FANG', 'HAL', 'KMI', 'WMB', 'ENPH', 'FSLR', 'RUN', 'NEE', 'PLUG', 'BE'],
  nuclear: ['NNE', 'OKLO', 'SMR', 'CCJ', 'LEU', 'UUUU', 'UEC', 'DNN', 'BWXT', 'VST', 'CEG', 'TLN', 'ASPI', 'LTBR', 'NLR'],
  fintech: ['SOFI', 'HOOD', 'COIN', 'MSTR', 'PYPL', 'SQ', 'AFRM', 'UPST', 'NU', 'V', 'MA', 'BITF', 'BMNR', 'MARA', 'RIOT', 'CLSK', 'CIFR', 'GLXY'],
  biotech: ['NTLA', 'CRSP', 'BEAM', 'MRNA', 'VRTX', 'REGN', 'AMGN', 'GILD', 'ALNY', 'SRPT', 'RXRX', 'TEM', 'ILMN', 'EXAS', 'IONS'],
  ev: ['TSLA', 'RIVN', 'LCID', 'NIO', 'XPEV', 'LI', 'BYDDY', 'GM', 'F', 'CHPT', 'BLNK', 'QS', 'ACHR', 'JOBY', 'EVTL'],
  semis: ['NVDA', 'AMD', 'MU', 'AVGO', 'TSM', 'INTC', 'QCOM', 'ARM', 'MRVL', 'LRCX', 'AMAT', 'KLAC', 'ASML', 'ON', 'TXN', 'ADI', 'SMCI', 'CRDO', 'ALAB', 'NXPI'],
  quantum: ['IONQ', 'RGTI', 'QBTS', 'QUBT', 'ARQQ', 'HON', 'IBM', 'GOOGL', 'MSFT', 'NVDA'],
};

SECTOR_UNIVERSE.all = [...new Set(Object.values(SECTOR_UNIVERSE).flat())];

const CRITERIA = new Set(['highest_volume', 'top_gainers', 'trending', 'highest_dividends', 'highest_eps', 'highest_pe']);
const FUNDAMENTAL_CRITERIA = new Set(['highest_dividends', 'highest_eps', 'highest_pe']);

interface Row {
  ticker: string;
  price: number;
  change: number;
  volume: number;
  volumeChange: number;
  dividendYield?: number;
  eps?: number;
  pe?: number;
}

// Yahoo's quoteSummary endpoint requires a cookie + crumb pair.
let auth: { cookie: string; crumb: string; ts: number } | null = null;
async function getYahooAuth(): Promise<{ cookie: string; crumb: string } | null> {
  if (auth && Date.now() - auth.ts < 30 * 60 * 1000) return auth;
  try {
    const res = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    const setCookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    const raw = setCookies.length ? setCookies : [res.headers.get('set-cookie') ?? ''];
    const cookie = raw.filter(Boolean).map((c) => c.split(';')[0]).join('; ');
    await res.body?.cancel();
    if (!cookie) return null;
    const cr = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
    });
    const crumb = (await cr.text()).trim();
    if (!crumb || crumb.length > 32) return null;
    auth = { cookie, crumb, ts: Date.now() };
    return auth;
  } catch {
    return null;
  }
}

async function fetchFundamentals(ticker: string): Promise<{ dividendYield: number; eps: number; pe: number } | null> {
  try {
    const a = await getYahooAuth();
    if (!a) return null;
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=summaryDetail,defaultKeyStatistics&crumb=${encodeURIComponent(a.crumb)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Cookie: a.cookie } });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.quoteSummary?.result?.[0];
    if (!r) return null;
    const sd = r.summaryDetail ?? {};
    const ks = r.defaultKeyStatistics ?? {};
    let dy = Number(sd.dividendYield?.raw ?? sd.trailingAnnualDividendYield?.raw ?? 0);
    if (dy > 0 && dy < 1) dy = dy * 100; // Yahoo sometimes returns a fraction
    const eps = Number(ks.trailingEps?.raw ?? 0);
    const pe = Number(sd.trailingPE?.raw ?? ks.forwardPE?.raw ?? 0);
    return { dividendYield: Number.isFinite(dy) ? dy : 0, eps: Number.isFinite(eps) ? eps : 0, pe: Number.isFinite(pe) ? pe : 0 };
  } catch {
    return null;
  }
}


async function fetchRow(ticker: string, withFundamentals: boolean): Promise<Row | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1mo`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const price = Number(meta?.regularMarketPrice ?? 0);
    if (!price) return null;
    const prevClose = Number(meta?.previousClose ?? meta?.chartPreviousClose ?? 0);
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    const volume = Number(meta?.regularMarketVolume ?? 0);
    const vols: number[] = (result.indicators?.quote?.[0]?.volume ?? [])
      .filter((v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
    const prior = vols.slice(0, -1);
    const avg = prior.length
      ? prior.reduce((a, b) => a + b, 0) / prior.length
      : Number(meta?.averageDailyVolume3Month ?? 0);
    const volumeChange = avg > 0 ? ((volume - avg) / avg) * 100 : 0;
    const row: Row = { ticker, price, change, volume, volumeChange };
    if (withFundamentals) {
      const f = await fetchFundamentals(ticker);
      if (f) Object.assign(row, f);
    }
    return row;
  } catch {
    return null;
  }
}

const cache = new Map<string, { rows: Row[]; ts: number }>();
const TTL = 10 * 60 * 1000;


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const sector = String(body?.sector ?? '').toLowerCase();
    const criterion = String(body?.criterion ?? '').toLowerCase();

    if (!SECTOR_UNIVERSE[sector] || !CRITERIA.has(criterion)) {
      return new Response(JSON.stringify({ error: 'Invalid sector or criterion' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = `${sector}:${criterion}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) {
      return new Response(JSON.stringify({ rows: hit.rows, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const universe = SECTOR_UNIVERSE[sector];
    const withFundamentals = FUNDAMENTAL_CRITERIA.has(criterion);
    const rows: Row[] = [];
    for (let i = 0; i < universe.length; i += 15) {
      const batch = await Promise.all(universe.slice(i, i + 15).map((t) => fetchRow(t, withFundamentals)));
      rows.push(...batch.filter((r): r is Row => !!r));
    }

    let pool = rows;
    if (criterion === 'highest_dividends') pool = rows.filter((r) => (r.dividendYield ?? 0) > 0);
    if (criterion === 'highest_eps') pool = rows.filter((r) => (r.eps ?? 0) > 0);
    if (criterion === 'highest_pe') pool = rows.filter((r) => (r.pe ?? 0) > 0);

    const sorted = [...pool].sort((a, b) => {
      if (criterion === 'highest_volume') return b.volume - a.volume;
      if (criterion === 'top_gainers') return b.change - a.change;
      if (criterion === 'highest_dividends') return (b.dividendYield ?? 0) - (a.dividendYield ?? 0);
      if (criterion === 'highest_eps') return (b.eps ?? 0) - (a.eps ?? 0);
      if (criterion === 'highest_pe') return (b.pe ?? 0) - (a.pe ?? 0);
      return b.volumeChange - a.volumeChange;
    }).slice(0, 15);


    cache.set(key, { rows: sorted, ts: Date.now() });

    return new Response(JSON.stringify({ rows: sorted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('market-screener error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
