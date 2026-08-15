import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const CLOB_BASE = 'https://clob.polymarket.com';

/**
 * Ephemeral, bounded, TTL-only in-process cache.
 * This is a cache, not a database — it is discarded on every cold start
 * and nothing here is written to the database or storage.
 */
const CACHE_TTL_MS = 45_000;          // discovery metadata TTL (30-60s window)
const SNAPSHOT_TTL_MS = 5_000;        // book / price-history snapshots
const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, { expires: number; body: string; status: number }>();

function cacheGet(key: string): { body: string; status: number } | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return { body: hit.body, status: hit.status };
}

function cacheSet(key: string, body: string, status: number, ttl: number) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // evict expired first, then oldest
    for (const [k, v] of cache) if (v.expires < Date.now()) cache.delete(k);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  }
  cache.set(key, { body, status, expires: Date.now() + ttl });
}

// Only these upstream path prefixes may be proxied.
const ALLOWED_CLOB_PREFIXES = ['book', 'books', 'prices-history', 'midpoint', 'price', 'spread'];
const ALLOWED_GAMMA_PREFIXES = ['events', 'markets', 'series'];

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'PolymarketProxy/2.0', Accept: 'application/json' },
      });
      clearTimeout(timeout);
      if (res.ok || res.status < 500) return res;
      lastErr = new Error(`upstream ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1) + Math.random() * 200));
  }
  throw lastErr instanceof Error ? lastErr : new Error('Max retries exceeded');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path') || '';
    const query = url.searchParams.get('query') || '';
    const source = url.searchParams.get('source') === 'clob' ? 'clob' : 'gamma';
    const base = source === 'clob' ? CLOB_BASE : GAMMA_BASE;

    let targetUrl: string;
    let ttl = SNAPSHOT_TTL_MS;

    if (path) {
      const prefix = path.split(/[/?]/)[0];
      const allowed = source === 'clob' ? ALLOWED_CLOB_PREFIXES : ALLOWED_GAMMA_PREFIXES;
      if (!allowed.includes(prefix)) {
        return new Response(JSON.stringify({ error: 'Path not allowed' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetUrl = `${base}/${path}`;
    } else if (query) {
      targetUrl = `${base}/events?${query}`;
      ttl = CACHE_TTL_MS;
    } else {
      return new Response(JSON.stringify({ error: 'Missing path or query param' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Discovery queries carry a moving `end_date_min`; bucket the key so the TTL cache can hit.
    const cacheKey = `${source}:${targetUrl.replace(/end_date_min=[^&]*/, `end_date_min=${Math.floor(Date.now() / CACHE_TTL_MS)}`)}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        status: cached.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
      });
    }

    const started = Date.now();
    const res = await fetchWithRetry(targetUrl);
    const data = await res.text();
    if (res.ok) cacheSet(cacheKey, data, res.status, ttl);

    // Aggregate diagnostics only — never raw upstream payloads.
    console.log(JSON.stringify({ source, kind: path ? path.split(/[/?]/)[0] : 'events', status: res.status, ms: Date.now() - started, bytes: data.length }));

    return new Response(data, {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
