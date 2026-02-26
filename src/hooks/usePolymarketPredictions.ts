import { useQuery } from '@tanstack/react-query';

export type PolymarketCoin = 'bitcoin' | 'ethereum' | 'solana' | 'xrp';
export type PolymarketTimeframe = '5 Min' | '15 Min' | 'Hourly' | '4 Hour' | 'Daily';

export interface PolymarketMarket {
  coin: PolymarketCoin;
  coinSymbol: string;
  timeframe: PolymarketTimeframe;
  question: string;
  targetPrice: number;
  yesPrice: number;   // 0-1 raw price (cost per share)
  noPrice: number;
  yesPayout: number;  // $1 payout for $1 bet on Yes
  noPayout: number;   // $1 payout for $1 bet on No
  conditionId: string;
  endDate: string;
}

interface GammaMarket {
  condition_id: string;
  question: string;
  tokens: { outcome: string; price: number }[];
  end_date_iso: string;
  active: boolean;
}

interface GammaEvent {
  title: string;
  markets: GammaMarket[];
}

const COIN_KEYWORDS: Record<PolymarketCoin, { keywords: string[]; symbol: string }> = {
  bitcoin: { keywords: ['bitcoin', 'btc'], symbol: 'BTC' },
  ethereum: { keywords: ['ethereum', 'eth'], symbol: 'ETH' },
  solana: { keywords: ['solana', 'sol'], symbol: 'SOL' },
  xrp: { keywords: ['xrp'], symbol: 'XRP' },
};

const TIMEFRAME_MAP: { label: PolymarketTimeframe; keywords: string[] }[] = [
  { label: '5 Min', keywords: ['5 min', '5-min', '5min'] },
  { label: '15 Min', keywords: ['15 min', '15-min', '15min'] },
  { label: 'Hourly', keywords: ['1 hour', '1-hour', 'hourly', '1h'] },
  { label: '4 Hour', keywords: ['4 hour', '4-hour', '4h'] },
  { label: 'Daily', keywords: ['daily', '1 day', '24 hour', '24h'] },
];

function detectCoin(question: string): { coin: PolymarketCoin; symbol: string } | null {
  const q = question.toLowerCase();
  for (const [coin, info] of Object.entries(COIN_KEYWORDS)) {
    if (info.keywords.some(kw => q.includes(kw))) {
      return { coin: coin as PolymarketCoin, symbol: info.symbol };
    }
  }
  return null;
}

function detectTimeframe(question: string): PolymarketTimeframe | null {
  const q = question.toLowerCase();
  for (const tf of TIMEFRAME_MAP) {
    if (tf.keywords.some(kw => q.includes(kw))) return tf.label;
  }
  return null;
}

function extractStrikePrice(question: string): number | null {
  const match = question.match(/\$?([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ''));
}

async function fetchAllPolymarketCrypto(): Promise<PolymarketMarket[]> {
  // Fetch crypto tag markets
  const res = await fetch(
    'https://gamma-api.polymarket.com/events?tag_id=100381&closed=false&active=true&limit=100&order=volume_24hr&ascending=false'
  );
  if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
  const events: GammaEvent[] = await res.json();

  const markets: PolymarketMarket[] = [];
  const seen = new Set<string>(); // coin+timeframe dedup key

  for (const event of events) {
    for (const market of event.markets) {
      if (!market.active) continue;

      const coinInfo = detectCoin(market.question);
      if (!coinInfo) continue;

      const timeframe = detectTimeframe(market.question);
      if (!timeframe) continue;

      const key = `${coinInfo.coin}-${timeframe}`;
      if (seen.has(key)) continue;

      const strike = extractStrikePrice(market.question);
      if (!strike) continue;

      const yesToken = market.tokens?.find(t => t.outcome === 'Yes');
      const noToken = market.tokens?.find(t => t.outcome === 'No');
      const yesPrice = yesToken?.price ?? 0.5;
      const noPrice = noToken?.price ?? 0.5;

      markets.push({
        coin: coinInfo.coin,
        coinSymbol: coinInfo.symbol,
        timeframe,
        question: market.question,
        targetPrice: strike,
        yesPrice,
        noPrice,
        yesPayout: yesPrice > 0 ? +(1 / yesPrice).toFixed(2) : 0,
        noPayout: noPrice > 0 ? +(1 / noPrice).toFixed(2) : 0,
        conditionId: market.condition_id,
        endDate: market.end_date_iso,
      });
      seen.add(key);
    }
  }

  return markets;
}

export function usePolymarketAll() {
  return useQuery({
    queryKey: ['polymarket-all-crypto'],
    queryFn: fetchAllPolymarketCrypto,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 2,
  });
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
      timeframe: m.timeframe,
      title: m.question,
      targetPrice: m.targetPrice,
      yesProb: Math.round(m.yesPrice * 100),
      conditionId: m.conditionId,
    })) ?? undefined;
  return { data: predictions, ...rest };
}
