import { useQuery } from '@tanstack/react-query';
import { fetchPrices, fetchPriceHistory, CoinId, Timeframe } from '@/lib/crypto-api';

export function useCryptoPrices() {
  return useQuery({
    queryKey: ['crypto-prices'],
    queryFn: fetchPrices,
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 2,
  });
}

export function usePriceHistory(coinId: CoinId, timeframe: Timeframe) {
  return useQuery({
    queryKey: ['price-history', coinId, timeframe],
    queryFn: () => fetchPriceHistory(coinId, timeframe),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 2,
  });
}
