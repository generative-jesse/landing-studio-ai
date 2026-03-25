import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path') || '';
    const query = url.searchParams.get('query') || '';
    
    let targetUrl: string;
    if (path) {
      // Direct path fetch: e.g. /events/slug/btc-updown-5m-12345
      targetUrl = `https://gamma-api.polymarket.com/${path}`;
    } else if (query) {
      // Search fetch: e.g. ?query=title=bitcoin+up+or+down&active=true
      targetUrl = `https://gamma-api.polymarket.com/events?${query}`;
    } else {
      return new Response(JSON.stringify({ error: 'Missing path or query param' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(targetUrl);
    const data = await res.text();

    return new Response(data, {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
