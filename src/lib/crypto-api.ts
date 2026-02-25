const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

export const COINS = {
  bitcoin: { symbol: 'BTC', name: 'Bitcoin', color: 'hsl(36, 100%, 50%)' },
  ethereum: { symbol: 'ETH', name: 'Ethereum', color: 'hsl(228, 60%, 60%)' },
  solana: { symbol: 'SOL', name: 'Solana', color: 'hsl(270, 80%, 65%)' },
  ripple: { symbol: 'XRP', name: 'XRP', color: 'hsl(0, 0%, 70%)' },
} as const;

export type CoinId = keyof typeof COINS;
export const COIN_IDS = Object.keys(COINS) as CoinId[];

export interface CoinPrice {
  usd: number;
  usd_24h_change: number;
  usd_24h_vol: number;
  usd_market_cap: number;
}

export type Timeframe = '5m' | '15m' | '1h';

export interface ChartPoint {
  time: string;
  timestamp: number;
  price: number;
}

export interface PriceTargets {
  support: number;
  resistance: number;
  mid: number;
}

export async function fetchPrices(): Promise<Record<CoinId, CoinPrice>> {
  const res = await fetch(
    `${COINGECKO_BASE}/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`
  );
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
  return res.json();
}

export async function fetchPriceHistory(coinId: CoinId, timeframe: Timeframe): Promise<ChartPoint[]> {
  const days = timeframe === '1h' ? 7 : 1;
  const res = await fetch(
    `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
  );
  if (!res.ok) throw new Error(`CoinGecko history error: ${res.status}`);
  const data = await res.json();
  
  let points: [number, number][] = data.prices;
  
  // Downsample for 15m view
  if (timeframe === '15m') {
    points = points.filter((_, i) => i % 3 === 0);
  }
  
  return points.map(([timestamp, price]) => ({
    time: new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      ...(timeframe === '1h' ? { month: 'short', day: 'numeric' } : {})
    }),
    timestamp,
    price: Number(price.toFixed(2)),
  }));
}

export function calculatePriceTargets(data: ChartPoint[]): PriceTargets {
  if (!data.length) return { support: 0, resistance: 0, mid: 0 };
  const prices = data.map(d => d.price);
  const support = Math.min(...prices);
  const resistance = Math.max(...prices);
  return {
    support: Number(support.toFixed(2)),
    resistance: Number(resistance.toFixed(2)),
    mid: Number(((support + resistance) / 2).toFixed(2)),
  };
}

export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  return price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 });
}

export function formatVolume(vol: number): string {
  if (vol >= 1e12) return `$${(vol / 1e12).toFixed(2)}T`;
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  return `$${vol.toLocaleString()}`;
}

export function formatMarketCap(cap: number): string {
  return formatVolume(cap);
}
