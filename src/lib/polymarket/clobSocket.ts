import { BookLevel, TokenQuote } from './types';

export const CLOB_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

export interface SocketMetrics {
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';
  reconnects: number;
  subscribedTokens: number;
  eventsReceived: number;
  invalidMessages: number;
  lastEventAt: number | null;
  lastServerTimestamp: number | null;
}

export interface ClobSocketHandlers {
  onQuote: (quote: TokenQuote) => void;
  onMetrics?: (metrics: SocketMetrics) => void;
}

/** Capped exponential backoff with jitter. Exported for tests. */
export function backoffDelay(attempt: number, base = 500, cap = 15_000, rand = Math.random): number {
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + rand() * (exp / 2));
}

function toLevels(raw: any[]): BookLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({ price: parseFloat(l?.price), size: parseFloat(l?.size) }))
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.size) && l.size > 0);
}

function deriveQuote(prev: TokenQuote, patch: Partial<TokenQuote>): TokenQuote {
  const next: TokenQuote = { ...prev, ...patch };
  if (patch.bids) next.bestBid = patch.bids.length ? Math.max(...patch.bids.map((l) => l.price)) : null;
  if (patch.asks) next.bestAsk = patch.asks.length ? Math.min(...patch.asks.map((l) => l.price)) : null;
  next.mid =
    next.bestBid != null && next.bestAsk != null ? (next.bestBid + next.bestAsk) / 2 : null;
  next.spread =
    next.bestBid != null && next.bestAsk != null ? next.bestAsk - next.bestBid : null;
  next.source = next.mid != null ? 'mid' : next.lastTrade != null ? 'last' : null;
  return next;
}

export function emptyQuote(tokenId: string): TokenQuote {
  return {
    tokenId,
    bestBid: null,
    bestAsk: null,
    mid: null,
    spread: null,
    lastTrade: null,
    source: null,
    bids: [],
    asks: [],
    eventTimestamp: null,
    receivedAt: null,
  };
}

/** Apply one official CLOB market-channel message to the token quote map (pure, testable). */
export function applyMessage(
  quotes: Map<string, TokenQuote>,
  msg: any,
  receivedAt = Date.now(),
): string[] {
  const touched: string[] = [];
  const eventType = msg?.event_type;

  const upsert = (tokenId: string, patch: Partial<TokenQuote>, ts: number | null) => {
    if (!tokenId || !quotes.has(tokenId)) return;
    const prev = quotes.get(tokenId)!;
    if (ts != null && prev.eventTimestamp != null && ts < prev.eventTimestamp) return; // out-of-order
    quotes.set(tokenId, deriveQuote(prev, { ...patch, eventTimestamp: ts ?? prev.eventTimestamp, receivedAt }));
    touched.push(tokenId);
  };

  const ts = msg?.timestamp ? Number(msg.timestamp) : null;

  if (eventType === 'book' || (msg?.bids && msg?.asks && msg?.asset_id)) {
    upsert(String(msg.asset_id), { bids: toLevels(msg.bids), asks: toLevels(msg.asks) }, ts);
    return touched;
  }

  if (eventType === 'price_change' || Array.isArray(msg?.price_changes)) {
    for (const change of msg.price_changes ?? []) {
      const bid = parseFloat(change?.best_bid);
      const ask = parseFloat(change?.best_ask);
      upsert(
        String(change?.asset_id),
        {
          bestBid: Number.isFinite(bid) ? bid : undefined,
          bestAsk: Number.isFinite(ask) ? ask : undefined,
        } as Partial<TokenQuote>,
        ts,
      );
      // recompute mid/spread from explicit best bid/ask
      const tokenId = String(change?.asset_id);
      const q = quotes.get(tokenId);
      if (q) {
        quotes.set(tokenId, deriveQuote(q, {}));
      }
    }
    return touched;
  }

  if (eventType === 'last_trade_price' || (msg?.price && msg?.asset_id && msg?.side)) {
    const price = parseFloat(msg.price);
    if (Number.isFinite(price)) upsert(String(msg.asset_id), { lastTrade: price }, ts);
    return touched;
  }

  if (eventType === 'tick_size_change') return touched;
  return touched;
}

/**
 * Resilient CLOB market-channel connection manager.
 * All state lives in memory; nothing is persisted.
 */
export class ClobMarketSocket {
  private ws: WebSocket | null = null;
  private tokens: string[] = [];
  private quotes = new Map<string, TokenQuote>();
  private pingTimer?: ReturnType<typeof setInterval>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private disposed = false;
  private metrics: SocketMetrics = {
    status: 'idle',
    reconnects: 0,
    subscribedTokens: 0,
    eventsReceived: 0,
    invalidMessages: 0,
    lastEventAt: null,
    lastServerTimestamp: null,
  };

  constructor(private handlers: ClobSocketHandlers, private url = CLOB_WS_URL) {}

  getMetrics(): SocketMetrics {
    return { ...this.metrics };
  }

  getQuote(tokenId: string): TokenQuote | null {
    return this.quotes.get(tokenId) ?? null;
  }

  /** Replace the subscription set. Old subscriptions are torn down immediately. */
  subscribe(tokens: string[]): void {
    const next = tokens.filter(Boolean);
    const same = next.length === this.tokens.length && next.every((t) => this.tokens.includes(t));
    if (same && this.ws?.readyState === WebSocket.OPEN) return;

    this.tokens = next;
    this.quotes = new Map(next.map((t) => [t, emptyQuote(t)]));
    this.metrics.subscribedTokens = next.length;
    this.emitMetrics();

    // The market channel has no unsubscribe frame: close and reopen with the new set.
    this.teardownSocket();
    if (next.length) this.connect();
    else this.setStatus('idle');
  }

  unsubscribeAll(): void {
    this.tokens = [];
    this.quotes.clear();
    this.metrics.subscribedTokens = 0;
    this.teardownSocket();
    this.setStatus('idle');
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.reconnectTimer);
    this.unsubscribeAll();
    this.setStatus('closed');
  }

  private setStatus(status: SocketMetrics['status']) {
    this.metrics.status = status;
    this.emitMetrics();
  }

  private emitMetrics() {
    this.handlers.onMetrics?.({ ...this.metrics });
  }

  private teardownSocket() {
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* noop */
      }
    }
  }

  private connect() {
    if (this.disposed || !this.tokens.length) return;
    this.setStatus(this.attempt > 0 ? 'reconnecting' : 'connecting');

    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.attempt = 0;
      this.setStatus('open');
      ws.send(JSON.stringify({ assets_ids: this.tokens, type: 'market' }));
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('PING');
      }, 10_000);
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      const raw = typeof event.data === 'string' ? event.data : '';
      if (!raw || raw === 'PONG') return;
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        this.metrics.invalidMessages++;
        return;
      }
      const messages = Array.isArray(parsed) ? parsed : [parsed];
      const now = Date.now();
      for (const msg of messages) {
        const touched = applyMessage(this.quotes, msg, now);
        if (!touched.length) {
          if (msg?.event_type && msg.event_type !== 'tick_size_change') this.metrics.invalidMessages++;
          continue;
        }
        this.metrics.eventsReceived++;
        this.metrics.lastEventAt = now;
        const ts = Number(msg?.timestamp);
        if (Number.isFinite(ts)) this.metrics.lastServerTimestamp = ts;
        for (const tokenId of new Set(touched)) {
          const quote = this.quotes.get(tokenId);
          if (quote) this.handlers.onQuote(quote);
        }
      }
      this.emitMetrics();
    };

    ws.onerror = () => {
      if (this.ws === ws) ws.close();
    };

    ws.onclose = () => {
      if (this.ws !== ws || this.disposed) return;
      clearInterval(this.pingTimer);
      this.ws = null;
      if (!this.tokens.length) return;
      this.attempt++;
      this.metrics.reconnects++;
      this.setStatus('reconnecting');
      this.reconnectTimer = setTimeout(() => this.connect(), backoffDelay(this.attempt));
    };
  }
}
