import { useEffect, useMemo, useRef, useState } from 'react';
import { CoinId } from '@/lib/crypto-api';
import { ClobMarketSocket, SocketMetrics, emptyQuote } from '@/lib/polymarket/clobSocket';
import { fetchBookSnapshot } from '@/lib/polymarket/api';
import { useMarketDiscovery } from '@/hooks/usePolymarketDiscovery';
import { pickCurrent } from '@/lib/polymarket/discovery';
import { ConnectionStatus, DiscoveredMarket, PolyTimeframe, TIMEFRAMES, TokenQuote } from '@/lib/polymarket/types';

const STALE_AFTER_MS = 20_000;
const FALLBACK_POLL_MS = 8_000;

export interface LiveTimeframeRow {
  timeframe: PolyTimeframe;
  market: DiscoveredMarket | null;
  up: TokenQuote | null;
  down: TokenQuote | null;
  msToExpiry: number | null;
}

export interface CoinLiveState {
  rows: LiveTimeframeRow[];
  status: ConnectionStatus;
  metrics: SocketMetrics;
  isDiscovering: boolean;
  lastUpdateAt: number;
}

function deriveStatus(metrics: SocketMetrics, now: number): ConnectionStatus {
  if (metrics.status === 'idle') return 'idle';
  if (metrics.status === 'closed') return 'closed';
  if (metrics.status === 'connecting') return 'connecting';
  if (metrics.status === 'reconnecting') return 'reconnecting';
  if (!metrics.lastEventAt) return 'connecting';
  return now - metrics.lastEventAt > STALE_AFTER_MS ? 'stale' : 'live';
}

/**
 * Streams live Polymarket CLOB quotes for the 5m / 15m / 1h up-down markets of one coin.
 * One WebSocket, up to six tokens, everything in memory only (per-session).
 */
export function usePolymarketCoinLive(coin: CoinId): CoinLiveState {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { markets, isLoading } = useMarketDiscovery();

  const active = useMemo(() => {
    const out: Record<PolyTimeframe, DiscoveredMarket | null> = { '5m': null, '15m': null, '1h': null };
    for (const tf of TIMEFRAMES) out[tf] = pickCurrent(markets, coin, tf, now);
    return out;
    // recompute only when the resolved market ids change, not every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, coin, Math.floor(now / 5000)]);

  const subscriptionKey = TIMEFRAMES.map((tf) => active[tf]?.marketId ?? '-').join('|');

  const [quotes, setQuotes] = useState<Record<string, TokenQuote>>({});
  const [metrics, setMetrics] = useState<SocketMetrics>({
    status: 'idle',
    reconnects: 0,
    subscribedTokens: 0,
    eventsReceived: 0,
    invalidMessages: 0,
    lastEventAt: null,
    lastServerTimestamp: null,
  });

  const pendingRef = useRef<Record<string, TokenQuote>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tokens: string[] = [];
    for (const tf of TIMEFRAMES) {
      const m = active[tf];
      if (m) tokens.push(m.upTokenId, m.downTokenId);
    }

    setQuotes((prev) => {
      const next: Record<string, TokenQuote> = {};
      for (const t of tokens) next[t] = prev[t] ?? emptyQuote(t);
      return next;
    });
    pendingRef.current = {};

    if (!tokens.length) return;

    const flush = () => {
      rafRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = {};
      if (!Object.keys(pending).length) return;
      setQuotes((prev) => ({ ...prev, ...pending }));
    };

    const schedule = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
    };

    const socket = new ClobMarketSocket({
      onQuote: (quote) => {
        pendingRef.current[quote.tokenId] = quote;
        schedule();
      },
      onMetrics: (m) => setMetrics(m),
    });
    socket.subscribe(tokens);

    // REST fallback: keeps prices present even if the socket is blocked or silent.
    let cancelled = false;
    const poll = async () => {
      const snapshots = await Promise.allSettled(tokens.map((t) => fetchBookSnapshot(t)));
      if (cancelled) return;
      const patch: Record<string, TokenQuote> = {};
      snapshots.forEach((res, i) => {
        if (res.status !== 'fulfilled') return;
        const book: any = res.value;
        const bids = Array.isArray(book?.bids) ? book.bids.map((b: any) => parseFloat(b.price)).filter(Number.isFinite) : [];
        const asks = Array.isArray(book?.asks) ? book.asks.map((a: any) => parseFloat(a.price)).filter(Number.isFinite) : [];
        const bestBid = bids.length ? Math.max(...bids) : null;
        const bestAsk = asks.length ? Math.min(...asks) : null;
        if (bestBid == null && bestAsk == null) return;
        patch[tokens[i]] = {
          ...emptyQuote(tokens[i]),
          bestBid,
          bestAsk,
          mid: bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null,
          spread: bestBid != null && bestAsk != null ? bestAsk - bestBid : null,
          source: bestBid != null && bestAsk != null ? 'mid' : 'last',
          receivedAt: Date.now(),
        };
      });
      setQuotes((prev) => {
        const next = { ...prev };
        for (const [token, q] of Object.entries(patch)) {
          const existing = prev[token];
          // never overwrite a fresher websocket quote
          if (existing?.receivedAt && Date.now() - existing.receivedAt < FALLBACK_POLL_MS) continue;
          next[token] = q;
        }
        return next;
      });
    };

    poll();
    const pollTimer = setInterval(() => {
      const last = socket.getMetrics().lastEventAt;
      if (!last || Date.now() - last > FALLBACK_POLL_MS) poll();
    }, FALLBACK_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      socket.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionKey]);

  const rows: LiveTimeframeRow[] = TIMEFRAMES.map((tf) => {
    const market = active[tf];
    return {
      timeframe: tf,
      market,
      up: market ? quotes[market.upTokenId] ?? null : null,
      down: market ? quotes[market.downTokenId] ?? null : null,
      msToExpiry: market ? market.endTime - now : null,
    };
  });

  const lastUpdateAt = Math.max(0, ...Object.values(quotes).map((q) => q?.receivedAt ?? 0));

  return {
    rows,
    status: deriveStatus(metrics, now),
    metrics,
    isDiscovering: isLoading,
    lastUpdateAt,
  };
}
