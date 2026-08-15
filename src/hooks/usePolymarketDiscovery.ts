import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { CoinId } from '@/lib/crypto-api';
import { discoverMarkets } from '@/lib/polymarket/api';
import { pickCurrent, pickSuccessor } from '@/lib/polymarket/discovery';
import { DiscoveredMarket, PolyTimeframe } from '@/lib/polymarket/types';

const NORMAL_INTERVAL = 45_000; // 30-60s discovery cache window
const ROLLOVER_INTERVAL = 12_000; // faster only in the last 60s before expiry
const ROLLOVER_WINDOW_MS = 60_000;

/** Gamma discovery for all supported assets/timeframes. Results are ephemeral. */
export function useMarketDiscovery(rolloverSoon = false) {
  const query = useQuery({
    queryKey: ['polymarket-discovery'],
    queryFn: ({ signal }) => discoverMarkets(signal),
    refetchInterval: rolloverSoon ? ROLLOVER_INTERVAL : NORMAL_INTERVAL,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(15_000, 1000 * 2 ** attempt),
  });

  return {
    ...query,
    markets: query.data ?? [],
  };
}

/**
 * Resolve the currently active market for one asset/timeframe and roll over
 * cleanly to the successor when it expires.
 */
export function useActiveMarket(asset: CoinId, timeframe: PolyTimeframe) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rollover pre-check: only speed up discovery in the final minute.
  const [rolloverSoon, setRolloverSoon] = useState(false);
  const { markets, isLoading, isError, error, dataUpdatedAt, refetch } = useMarketDiscovery(rolloverSoon);

  const current = useMemo(
    () => pickCurrent(markets, asset, timeframe, now),
    [markets, asset, timeframe, now],
  );

  const successor = useMemo(
    () => (current ? pickSuccessor(markets, current, now) : null),
    [markets, current, now],
  );

  const msToExpiry = current ? current.endTime - now : null;

  useEffect(() => {
    const soon = msToExpiry != null && msToExpiry <= ROLLOVER_WINDOW_MS;
    setRolloverSoon(soon);
    if (soon && !successor) refetch();
  }, [msToExpiry != null && msToExpiry <= ROLLOVER_WINDOW_MS, successor, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    market: current,
    successor,
    msToExpiry,
    markets,
    isLoading,
    isError,
    error: error as Error | null,
    discoveredAt: dataUpdatedAt,
    refetch,
  };
}
