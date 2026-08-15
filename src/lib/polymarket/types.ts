import { CoinId } from '@/lib/crypto-api';

export type PolyTimeframe = '5m' | '15m' | '1h';

export const TIMEFRAMES: PolyTimeframe[] = ['5m', '15m', '1h'];

export const TIMEFRAME_MS: Record<PolyTimeframe, number> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
};

/** Normalized Polymarket market metadata (discovery output). Ephemeral only. */
export interface DiscoveredMarket {
  eventId: string;
  marketId: string;
  conditionId: string;
  slug: string;
  eventSlug: string;
  title: string;
  question: string;
  asset: CoinId;
  timeframe: PolyTimeframe;
  seriesSlug: string | null;
  timeRange: string;
  startTime: number | null;
  endTime: number;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
  upTokenId: string;
  downTokenId: string;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'stale' | 'closed' | 'error';

export interface BookLevel {
  price: number;
  size: number;
}

/** Per-token derived live state kept in browser memory only. */
export interface TokenQuote {
  tokenId: string;
  bestBid: number | null;
  bestAsk: number | null;
  mid: number | null;
  spread: number | null;
  lastTrade: number | null;
  /** 'mid' when both sides exist, otherwise 'last' (fallback) or null. */
  source: 'mid' | 'last' | null;
  bids: BookLevel[];
  asks: BookLevel[];
  eventTimestamp: number | null;
  receivedAt: number | null;
}

export interface ChartPointLive {
  t: number;
  p: number;
  source: 'mid' | 'last' | 'history';
}
