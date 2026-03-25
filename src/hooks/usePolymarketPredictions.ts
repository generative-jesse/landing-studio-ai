import { useQuery } from '@tanstack/react-query';
import { CoinId } from '@/lib/crypto-api';

export type PolymarketTimeframe = '5m' | '15m' | '1h';

export interface UpDownMarket {
  coin: CoinId;
  coinSymbol: string;
  timeframe: PolymarketTimeframe;
  slug: string;
  question: string;
  priceToBeat: number;
  upPrice: number;   // 0-1
  downPrice: number;  // 0-1
  upPayout: number;   // return per $1
  downPayout: number;
  endDate: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const INTERVALS: Record<'5m' | '15m', number> = { '5m': 300, '15m': 900 };

const ASSET_SLUGS: Record<CoinId, string> = {
  bitcoin: 'btc',
  ethereum: 'eth',
  solana: 'sol',
  ripple: 'xrp',
};

const ASSET_SYMBOLS: Record<CoinId, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  ripple: 'XRP',
};

const SEARCH_TERMS: Record<CoinId, string> = {
  bitcoin: 'bitcoin up or down',
  ethereum: 'ethereum up or down',
  solana: 'solana up or down',
  ripple: 'xrp up or down',
};

async function proxyFetch(params: { path?: string; query?: string }): Promise<any> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/polymarket-proxy`);
  if (params.path) url.searchParams.set('path', params.path);
  if (params.query) url.searchParams.set('query', params.query);
  
  const res = await fetch(url.toString(), {
    headers: { 'apikey': SUPABASE_KEY },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy error ${res.status}: ${text}`);
  }
  return res.json();
}

function extractTimeRange(title: string): string {
  // Extract time range like "6:20AM-6:25AM ET"
  const match = title.match(/(\d{1,2}:\d{2}[AP]M\s*-\s*\d{1,2}:\d{2}[AP]M\s*ET)/i);
  return match ? match[1] : '';
}

function parseOutcomePrices(market: any): { upPrice: number; downPrice: number } {
  let upPrice = 0.5, downPrice = 0.5;
  
  // Try tokens array first (common in gamma API response)
  if (market.tokens && Array.isArray(market.tokens)) {
    for (const token of market.tokens) {
      const outcome = (token.outcome || '').toLowerCase();
      if (outcome === 'up' || outcome === 'yes') upPrice = parseFloat(token.price) || 0.5;
      if (outcome === 'down' || outcome === 'no') downPrice = parseFloat(token.price) || 0.5;
    }
    return { upPrice, downPrice };
  }
  
  // Try outcomePrices
  if (market.outcomePrices) {
    try {
      const prices = typeof market.outcomePrices === 'string' 
        ? JSON.parse(market.outcomePrices) 
        : market.outcomePrices;
      if (Array.isArray(prices) && prices.length >= 2) {
        upPrice = parseFloat(prices[0]) || 0.5;
        downPrice = parseFloat(prices[1]) || 0.5;
      }
    } catch {}
  }
  
  return { upPrice, downPrice };
}

function parseEventToMarket(event: any, coin: CoinId, timeframe: PolymarketTimeframe): UpDownMarket | null {
  const slug = event.slug || '';
  const priceToBeat = extractPriceToBeat(event);
  
  // Get prices from first market in event
  const market = event.markets?.[0] || event;
  const { upPrice, downPrice } = parseOutcomePrices(market);
  
  if (!priceToBeat && !slug) return null;
  
  return {
    coin,
    coinSymbol: ASSET_SYMBOLS[coin],
    timeframe,
    slug,
    question: event.title || market.question || '',
    priceToBeat: priceToBeat || 0,
    upPrice,
    downPrice,
    upPayout: upPrice > 0 ? +(1 / upPrice).toFixed(2) : 0,
    downPayout: downPrice > 0 ? +(1 / downPrice).toFixed(2) : 0,
    endDate: event.endDate || market.end_date_iso || '',
  };
}

async function fetchEpochMarket(coin: CoinId, tf: '5m' | '15m'): Promise<UpDownMarket | null> {
  const interval = INTERVALS[tf];
  const nowSec = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(nowSec / interval) * interval;
  const prevWindow = currentWindow - interval;
  const nextWindow = currentWindow + interval;
  
  const slugPrefix = ASSET_SLUGS[coin];
  const slugs = [
    `${slugPrefix}-updown-${tf}-${nextWindow}`,
    `${slugPrefix}-updown-${tf}-${currentWindow}`,
    `${slugPrefix}-updown-${tf}-${prevWindow}`,
  ];
  
  for (const slug of slugs) {
    try {
      const event = await proxyFetch({ path: `events/slug/${slug}` });
      if (event && !event.error && event.slug) {
        // Check if not closed
        if (event.closed) continue;
        const endDate = new Date(event.endDate || event.end_date_iso || 0);
        if (endDate.getTime() < Date.now()) continue;
        
        const market = parseEventToMarket(event, coin, tf);
        if (market) return market;
      }
    } catch {
      // Try next slug
    }
  }
  return null;
}

async function fetchSearchMarket(coin: CoinId): Promise<UpDownMarket | null> {
  const searchTerm = SEARCH_TERMS[coin];
  try {
    const events = await proxyFetch({ 
      query: `title=${encodeURIComponent(searchTerm)}&active=true&closed=false&limit=10` 
    });
    
    if (!Array.isArray(events)) return null;
    
    // Find 1h market: look for hourly time range in title
    for (const event of events) {
      const title = (event.title || '').toLowerCase();
      // Match patterns like "4am-5am", "10pm-11pm" indicating 1-hour windows
      const hourlyMatch = title.match(/(\d{1,2})(am|pm)\s*-\s*(\d{1,2})(am|pm)/i);
      if (hourlyMatch) {
        const market = parseEventToMarket(event, coin, '1h');
        if (market) return market;
      }
    }
    
    // Fallback: just take the first active non-daily event
    for (const event of events) {
      const title = (event.title || '').toLowerCase();
      const slug = (event.slug || '').toLowerCase();
      // Skip daily markets
      if (slug.includes('on-march') || slug.includes('on-april') || slug.includes('on-feb') || title.includes('on march') || title.includes('on april')) continue;
      const market = parseEventToMarket(event, coin, '1h');
      if (market) return market;
    }
  } catch {}
  return null;
}

async function fetchAllMarkets(): Promise<UpDownMarket[]> {
  const coins: CoinId[] = ['bitcoin', 'ethereum', 'solana', 'ripple'];
  const timeframes: PolymarketTimeframe[] = ['5m', '15m', '1h'];
  
  const promises: Promise<UpDownMarket | null>[] = [];
  
  for (const coin of coins) {
    for (const tf of timeframes) {
      if (tf === '5m' || tf === '15m') {
        promises.push(fetchEpochMarket(coin, tf));
      } else {
        promises.push(fetchSearchMarket(coin));
      }
    }
  }
  
  const results = await Promise.allSettled(promises);
  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((m): m is UpDownMarket => m !== null);
}

export function usePolymarketAll() {
  return useQuery({
    queryKey: ['polymarket-updown-all'],
    queryFn: fetchAllMarkets,
    refetchInterval: 30000,
    staleTime: 15000,
    retry: 2,
  });
}

// Filter markets for a specific coin
export function usePolymarketForCoin(coin: CoinId) {
  const { data, ...rest } = usePolymarketAll();
  const markets = data?.filter(m => m.coin === coin) ?? [];
  return { data: markets, ...rest };
}

// Legacy hook for chart overlay (BTC only)
export interface PolymarketPrediction {
  timeframe: string;
  title: string;
  targetPrice: number;
  yesProb: number;
  conditionId: string;
}

export function usePolymarketPredictions() {
  const { data, ...rest } = usePolymarketAll();
  const predictions = data
    ?.filter(m => m.coin === 'bitcoin')
    .map(m => ({
      timeframe: m.timeframe === '5m' ? '5 Min' : m.timeframe === '15m' ? '15 Min' : 'Hourly',
      title: m.question,
      targetPrice: m.priceToBeat,
      yesProb: Math.round(m.upPrice * 100),
      conditionId: m.slug,
    })) ?? undefined;
  return { data: predictions, ...rest };
}
