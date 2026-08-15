import { useEffect, useRef, useState } from 'react';
import { ClobMarketSocket, SocketMetrics, emptyQuote } from '@/lib/polymarket/clobSocket';
import { ChartRingBuffer, downsample } from '@/lib/polymarket/ringBuffer';
import { fetchPriceHistory } from '@/lib/polymarket/api';
import { ChartPointLive, ConnectionStatus, DiscoveredMarket, TokenQuote } from '@/lib/polymarket/types';

const BUFFER_CAPACITY = 1800;   // bounded ring buffer, ~ max points per outcome
const DISPLAY_POINTS = 320;     // display downsample target
const STALE_AFTER_MS = 15_000;

export interface LiveMarketState {
  up: TokenQuote;
  down: TokenQuote;
  points: ChartPointLive[];
  metrics: SocketMetrics;
  status: ConnectionStatus;
  lastPaintAt: number;
  bufferSize: number;
  historyError: string | null;
}

function initialState(market: DiscoveredMarket | null): LiveMarketState {
  return {
    up: emptyQuote(market?.upTokenId ?? ''),
    down: emptyQuote(market?.downTokenId ?? ''),
    points: [],
    metrics: {
      status: 'idle',
      reconnects: 0,
      subscribedTokens: 0,
      eventsReceived: 0,
      invalidMessages: 0,
      lastEventAt: null,
      lastServerTimestamp: null,
    },
    status: 'idle',
    lastPaintAt: 0,
    bufferSize: 0,
    historyError: null,
  };
}

function deriveStatus(metrics: SocketMetrics, now: number): ConnectionStatus {
  if (metrics.status === 'idle') return 'idle';
  if (metrics.status === 'closed') return 'closed';
  if (metrics.status === 'connecting') return 'connecting';
  if (metrics.status === 'reconnecting') return 'reconnecting';
  if (metrics.lastEventAt && now - metrics.lastEventAt > STALE_AFTER_MS) return 'stale';
  return 'live';
}

/**
 * Live CLOB state for one market.
 * - WebSocket events land in mutable refs (no setState per message)
 * - the UI repaints at most once per animation frame
 * - chart points live in a bounded in-memory ring buffer, never persisted
 */
export function usePolymarketLive(market: DiscoveredMarket | null): LiveMarketState {
  const [state, setState] = useState<LiveMarketState>(() => initialState(market));

  const socketRef = useRef<ClobMarketSocket | null>(null);
  const bufferRef = useRef<ChartRingBuffer>(new ChartRingBuffer(BUFFER_CAPACITY));
  const pendingRef = useRef<{ up?: TokenQuote; down?: TokenQuote; metrics?: SocketMetrics; dirty: boolean }>({ dirty: false });
  const rafRef = useRef<number | null>(null);
  const marketKey = market ? `${market.marketId}:${market.upTokenId}` : null;

  useEffect(() => {
    // Fresh buffers and socket per market — old ones are torn down first.
    bufferRef.current.clear();
    pendingRef.current = { dirty: false };
    setState(initialState(market));

    if (!market) {
      socketRef.current?.dispose();
      socketRef.current = null;
      return;
    }

    let cancelled = false;
    const buffer = bufferRef.current;

    const flush = () => {
      rafRef.current = null;
      const pending = pendingRef.current;
      if (!pending.dirty) return;
      pending.dirty = false;
      const now = Date.now();
      const metrics = pending.metrics;

      setState((prev) => {
        const next: LiveMarketState = {
          ...prev,
          up: pending.up ?? prev.up,
          down: pending.down ?? prev.down,
          metrics: metrics ?? prev.metrics,
          status: deriveStatus(metrics ?? prev.metrics, now),
          points: downsample(buffer.toArray(), DISPLAY_POINTS),
          bufferSize: buffer.size,
          lastPaintAt: now,
        };
        return next;
      });
    };

    const schedule = () => {
      pendingRef.current.dirty = true;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    };

    const socket = new ClobMarketSocket({
      onQuote: (quote) => {
        if (quote.tokenId === market.upTokenId) {
          pendingRef.current.up = quote;
          // Chart follows the UP outcome: midpoint when both sides exist, else last trade.
          const price = quote.mid ?? quote.lastTrade;
          if (price != null) {
            buffer.push({ t: quote.receivedAt ?? Date.now(), p: price, source: quote.mid != null ? 'mid' : 'last' });
          }
        } else if (quote.tokenId === market.downTokenId) {
          pendingRef.current.down = quote;
        }
        schedule();
      },
      onMetrics: (metrics) => {
        pendingRef.current.metrics = metrics;
        schedule();
      },
    });

    socketRef.current = socket;
    socket.subscribe([market.upTokenId, market.downTokenId]);

    // Bounded historical context for the chart (initial load only).
    fetchPriceHistory(market.upTokenId, market.timeframe)
      .then((history) => {
        if (cancelled) return;
        buffer.seed(history);
        schedule();
      })
      .catch((err) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, historyError: err instanceof Error ? err.message : 'history unavailable' }));
      });

    // Staleness ticker (cheap, no market data involved).
    const staleTimer = setInterval(() => {
      setState((prev) => {
        const status = deriveStatus(prev.metrics, Date.now());
        return status === prev.status ? prev : { ...prev, status };
      });
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(staleTimer);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      socket.dispose();
      socketRef.current = null;
      buffer.clear();
      pendingRef.current = { dirty: false };
    };
  }, [marketKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
