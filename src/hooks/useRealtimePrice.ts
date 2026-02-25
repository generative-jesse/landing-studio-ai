import { useEffect, useRef, useState, useCallback } from 'react';

export interface RealtimeTick {
  price: number;
  direction: 'up' | 'down' | 'neutral';
  timestamp: number;
}

export function useRealtimePrice(productId = 'BTC-USD') {
  const [tick, setTick] = useState<RealtimeTick | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastPriceRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'subscribe',
        product_ids: [productId],
        channels: ['ticker'],
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'ticker') return;

        const price = parseFloat(data.price);
        if (isNaN(price)) return;

        const prev = lastPriceRef.current;
        const direction: RealtimeTick['direction'] =
          prev === null ? 'neutral' : price > prev ? 'up' : price < prev ? 'down' : 'neutral';

        lastPriceRef.current = price;
        setTick({ price, direction, timestamp: Date.now() });
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [productId]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return tick;
}
