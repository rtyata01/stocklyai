import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const VISITOR_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

type VisitStatsRequest = {
  visitorId?: string;
  shouldTrack?: boolean;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { visitorId, shouldTrack }: VisitStatsRequest = await req.json();

    if (!visitorId || !VISITOR_ID_RE.test(visitorId)) {
      return json({ error: 'Valid visitorId is required.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Backend configuration missing.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (shouldTrack) {
      const { error: insertError } = await supabase
        .from('site_visits')
        .insert({ visitor_id: visitorId });

      if (insertError) {
        console.error('visit-stats insert error:', insertError);
      }
    }

    const { data, error } = await supabase.rpc('get_visit_stats');

    if (error) {
      console.error('visit-stats rpc error:', error);
      return json({ error: 'Failed to load visit stats.' }, 500);
    }

    const row = Array.isArray(data) ? data[0] : null;

    return json({
      total: Number(row?.total_visits ?? 0),
      unique: Number(row?.unique_visitors ?? 0),
    });
  } catch (error) {
    console.error('visit-stats error:', error);
    return json({ error: 'Internal server error.' }, 500);
  }
});