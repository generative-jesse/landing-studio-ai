import { CoinId, COIN_IDS } from '@/lib/crypto-api';
import { DiscoveredMarket, PolyTimeframe, TIMEFRAME_MS } from './types';

/**
 * Pure Gamma-API normalization / classification logic.
 * No network, no storage — safe to unit test.
 */

const ASSET_TOKENS: Record<CoinId, string[]> = {
  bitcoin: ['btc', 'bitcoin'],
  ethereum: ['eth', 'ethereum'],
  solana: ['sol', 'solana'],
  ripple: ['xrp', 'ripple'],
};

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Extract [upTokenId, downTokenId] honouring the market's outcome ordering. */
export function extractTokenIds(market: any): { upTokenId: string; downTokenId: string } | null {
  const ids = parseJsonArray(market?.clobTokenIds);
  if (ids.length < 2 || ids.some((id) => !id || id === 'null')) return null;

  const outcomes = parseJsonArray(market?.outcomes).map((o) => o.toLowerCase());
  const upIndex = outcomes.findIndex((o) => o === 'up' || o === 'yes');
  const downIndex = outcomes.findIndex((o) => o === 'down' || o === 'no');

  if (upIndex >= 0 && downIndex >= 0 && ids[upIndex] && ids[downIndex]) {
    return { upTokenId: ids[upIndex], downTokenId: ids[downIndex] };
  }
  return { upTokenId: ids[0], downTokenId: ids[1] };
}

export function matchAsset(event: any, market: any): CoinId | null {
  const haystacks = [event?.slug, event?.title, event?.seriesSlug, market?.slug, market?.question]
    .filter(Boolean)
    .map((s: string) => String(s).toLowerCase());

  for (const coin of COIN_IDS) {
    for (const token of ASSET_TOKENS[coin]) {
      const re = new RegExp(`(^|[^a-z])${token}([^a-z]|$)`);
      if (haystacks.some((h) => re.test(h))) return coin;
    }
  }
  return null;
}

/** Classify a Gamma event into a supported timeframe using series metadata, slug and title. */
export function classifyTimeframe(event: any, market: any): PolyTimeframe | null {
  const allSlugs = `${event?.slug ?? ''} ${event?.seriesSlug ?? ''} ${market?.slug ?? ''}`.toLowerCase();
  // Only binary up/down markets are supported (excludes "…-above-on-…" strike markets).
  if (!/updown|up-or-down/.test(allSlugs)) return null;

  const recurrence = String(event?.series?.[0]?.recurrence ?? '').toLowerCase();
  if (recurrence === '5m' || /-5m-\d+/.test(allSlugs)) return '5m';
  if (recurrence === '15m' || /-15m-\d+/.test(allSlugs)) return '15m';
  if (/-4h-\d+/.test(allSlugs) || /-1d-\d+/.test(allSlugs)) return null;
  if (recurrence === 'hourly' || recurrence === '1h') return '1h';


  const slug = `${event?.slug ?? ''} ${event?.seriesSlug ?? ''} ${market?.slug ?? ''}`.toLowerCase();
  if (/(^|[-\s])(updown|up-or-down)-5m([-\s]|$)/.test(slug) || /-5m-\d+/.test(slug)) return '5m';
  if (/(^|[-\s])(updown|up-or-down)-15m([-\s]|$)/.test(slug) || /-15m-\d+/.test(slug)) return '15m';
  if (/up-or-down-hourly/.test(slug) || /-1h-\d+/.test(slug)) return '1h';
  // Hourly events are slugged like `bitcoin-up-or-down-august-14-2026-10pm-et`
  if (/up-or-down-.*-\d{1,2}(am|pm)-et$/.test(slug)) return '1h';

  const title = String(event?.title ?? market?.question ?? '');
  const range = parseTitleRange(title);
  if (range) {
    if (range === TIMEFRAME_MS['5m']) return '5m';
    if (range === TIMEFRAME_MS['15m']) return '15m';
    if (range === TIMEFRAME_MS['1h']) return '1h';
    return null;
  }
  // Last resort: title says a single hour ("10PM ET") -> hourly market
  if (/\b\d{1,2}(am|pm)\s*et\b/i.test(title) && /up or down/i.test(title)) return '1h';
  return null;
}

/** Duration in ms implied by a "10:30PM-10:35PM ET" style title, or null. */
export function parseTitleRange(title: string): number | null {
  const m = title.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return null;
  const toMinutes = (h: string, mm: string | undefined, ap: string) => {
    let hour = parseInt(h, 10) % 12;
    if (ap.toUpperCase() === 'PM') hour += 12;
    return hour * 60 + (mm ? parseInt(mm, 10) : 0);
  };
  const start = toMinutes(m[1], m[2], m[3]);
  const end = toMinutes(m[4], m[5], m[6]);
  const diff = (end - start + 24 * 60) % (24 * 60);
  return diff > 0 ? diff * 60_000 : null;
}

export function extractTimeRange(title: string): string {
  const match = title.match(/(\d{1,2}(?::\d{2})?\s*[AP]M\s*(?:-\s*\d{1,2}(?::\d{2})?\s*[AP]M\s*)?ET)/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : '';
}

function toMs(value: unknown): number | null {
  if (!value) return null;
  const t = new Date(String(value)).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Normalize one Gamma event (with embedded markets) into supported DiscoveredMarkets. */
export function normalizeEvent(event: any): DiscoveredMarket[] {
  const markets: any[] = Array.isArray(event?.markets) ? event.markets : [];
  const out: DiscoveredMarket[] = [];

  for (const market of markets) {
    const asset = matchAsset(event, market);
    const timeframe = classifyTimeframe(event, market);
    const tokens = extractTokenIds(market);
    const endTime = toMs(market?.endDate) ?? toMs(event?.endDate);
    if (!asset || !timeframe || !tokens || !endTime) continue;

    out.push({
      eventId: String(event?.id ?? ''),
      marketId: String(market?.id ?? ''),
      conditionId: String(market?.conditionId ?? ''),
      slug: String(market?.slug ?? event?.slug ?? ''),
      eventSlug: String(event?.slug ?? ''),
      title: String(event?.title ?? market?.question ?? ''),
      question: String(market?.question ?? event?.title ?? ''),
      asset,
      timeframe,
      seriesSlug: event?.seriesSlug ? String(event.seriesSlug) : null,
      timeRange: extractTimeRange(String(event?.title ?? '')),
      startTime: toMs(market?.startDate) ?? toMs(event?.startDate),
      endTime,
      active: market?.active !== false && event?.active !== false,
      closed: market?.closed === true || event?.closed === true,
      acceptingOrders: market?.acceptingOrders !== false,
      enableOrderBook: market?.enableOrderBook === true,
      upTokenId: tokens.upTokenId,
      downTokenId: tokens.downTokenId,
    });
  }
  return out;
}

/** A market is tradable when it is open, order-book enabled and not yet expired. */
export function isTradable(market: DiscoveredMarket, now = Date.now()): boolean {
  return (
    market.active &&
    !market.closed &&
    market.acceptingOrders &&
    market.enableOrderBook &&
    Boolean(market.upTokenId && market.downTokenId) &&
    market.endTime > now
  );
}

/**
 * Pick the currently running market for an asset/timeframe:
 * the tradable candidate with the soonest expiry.
 */
export function pickCurrent(
  markets: DiscoveredMarket[],
  asset: CoinId,
  timeframe: PolyTimeframe,
  now = Date.now(),
): DiscoveredMarket | null {
  const candidates = markets
    .filter((m) => m.asset === asset && m.timeframe === timeframe && isTradable(m, now))
    .sort((a, b) => a.endTime - b.endTime);
  return candidates[0] ?? null;
}

/** Pick the market that takes over after `current` expires. */
export function pickSuccessor(
  markets: DiscoveredMarket[],
  current: DiscoveredMarket,
  now = Date.now(),
): DiscoveredMarket | null {
  const candidates = markets
    .filter(
      (m) =>
        m.asset === current.asset &&
        m.timeframe === current.timeframe &&
        m.marketId !== current.marketId &&
        m.endTime > current.endTime &&
        isTradable(m, now),
    )
    .sort((a, b) => a.endTime - b.endTime);
  return candidates[0] ?? null;
}

export function normalizeEvents(events: any[]): DiscoveredMarket[] {
  if (!Array.isArray(events)) return [];
  const seen = new Set<string>();
  const out: DiscoveredMarket[] = [];
  for (const event of events) {
    for (const market of normalizeEvent(event)) {
      const key = `${market.marketId}:${market.upTokenId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(market);
    }
  }
  return out;
}
