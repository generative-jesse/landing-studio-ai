import { useQuery } from '@tanstack/react-query';

export interface PolymarketPrediction {
  timeframe: string;
  title: string;
  targetPrice: number;
  yesProb: number;
  conditionId: string;
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

function classifyTimeframe(endDate: string): string | null {
  const diffMs = new Date(endDate).getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours <= 0) return null;
  if (diffHours <= 1) return 'Short-term';
  if (diffHours <= 24) return 'Mid-term';
  if (diffHours <= 168) return 'Long-term';
  return null;
}

function extractStrikePrice(question: string): number | null {
  // Match patterns like "$65,000" or "$65000" or "65,000" or "65000"
  const match = question.match(/\$?([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ''));
}

async function fetchPolymarketPredictions(): Promise<PolymarketPrediction[]> {
  const res = await fetch(
    'https://gamma-api.polymarket.com/events?tag_id=100381&closed=false&limit=20'
  );
  if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
  const events: GammaEvent[] = await res.json();

  const predictions: PolymarketPrediction[] = [];
  const seenTimeframes = new Set<string>();

  for (const event of events) {
    for (const market of event.markets) {
      if (!market.active) continue;

      const tf = classifyTimeframe(market.end_date_iso);
      if (!tf || seenTimeframes.has(tf)) continue;

      const strike = extractStrikePrice(market.question);
      if (!strike || strike < 10000) continue; // Filter non-BTC prices

      const yesToken = market.tokens?.find(t => t.outcome === 'Yes');
      const yesProb = yesToken?.price ?? 0;

      predictions.push({
        timeframe: tf,
        title: market.question,
        targetPrice: strike,
        yesProb: Math.round(yesProb * 100),
        conditionId: market.condition_id,
      });
      seenTimeframes.add(tf);
    }
    if (seenTimeframes.size >= 3) break;
  }

  return predictions;
}

export function usePolymarketPredictions() {
  return useQuery({
    queryKey: ['polymarket-predictions'],
    queryFn: fetchPolymarketPredictions,
    refetchInterval: 120000,
    staleTime: 60000,
    retry: 2,
  });
}
