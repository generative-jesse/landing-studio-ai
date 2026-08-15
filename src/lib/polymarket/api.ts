import { ChartPointLive, DiscoveredMarket, PolyTimeframe } from './types';
import { normalizeEvents } from './discovery';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/** All Polymarket REST traffic goes through the server proxy (short-TTL cache, no persistence). */
async function proxyFetch(params: { path?: string; query?: string; source?: 'gamma' | 'clob' }): Promise<any> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/polymarket-proxy`);
  if (params.path) url.searchParams.set('path', params.path);
  if (params.query) url.searchParams.set('query', params.query);
  if (params.source) url.searchParams.set('source', params.source);

  const res = await fetch(url.toString(), { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error(`Polymarket proxy error ${res.status}`);
  return res.json();
}

/**
 * Discovery: query Gamma for currently open crypto events and normalize them.
 * Source of truth for 5m / 15m / 1h markets — no slug guessing.
 */
export async function discoverMarkets(signal?: AbortSignal): Promise<DiscoveredMarket[]> {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const query = [
    'closed=false',
    'active=true',
    'limit=500',
    'order=endDate',
    'ascending=true',
    `end_date_min=${encodeURIComponent(now)}`,
    'tag_slug=crypto',
  ].join('&');

  const events = await proxyFetch({ query });
  if (signal?.aborted) return [];
  return normalizeEvents(events);
}

const HISTORY_PARAMS: Record<PolyTimeframe, { interval: string; fidelity: number }> = {
  '5m': { interval: '1h', fidelity: 1 },
  '15m': { interval: '6h', fidelity: 1 },
  '1h': { interval: '6h', fidelity: 1 },
};

/** Bounded historical context for the chart (initial load / market switch only). */
export async function fetchPriceHistory(
  tokenId: string,
  timeframe: PolyTimeframe,
  maxPoints = 400,
): Promise<ChartPointLive[]> {
  const { interval, fidelity } = HISTORY_PARAMS[timeframe];
  const data = await proxyFetch({
    source: 'clob',
    path: `prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`,
  });
  const history = Array.isArray(data?.history) ? data.history : [];
  return history
    .map((h: any) => ({ t: Number(h.t) * 1000, p: Number(h.p), source: 'history' as const }))
    .filter((p: ChartPointLive) => Number.isFinite(p.t) && Number.isFinite(p.p))
    .slice(-maxPoints);
}

/** Recovery snapshot only — never used for polling while the socket is healthy. */
export async function fetchBookSnapshot(tokenId: string) {
  return proxyFetch({ source: 'clob', path: `book?token_id=${tokenId}` });
}
