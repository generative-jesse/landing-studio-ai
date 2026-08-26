import { ExternalLink, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { CoinId, COINS } from '@/lib/crypto-api';
import { usePolymarketCoinLive, LiveTimeframeRow } from '@/hooks/usePolymarketCoinLive';
import { PolyTimeframe } from '@/lib/polymarket/types';
import { cn } from '@/lib/utils';

const TF_LABELS: Record<PolyTimeframe, string> = { '5m': '5 Min', '15m': '15 Min', '1h': '1 Hour' };

function fmt(price: number | null | undefined) {
  return price == null ? '—' : `$${price.toFixed(2)}`;
}

function countdown(ms: number | null) {
  if (ms == null || ms < 0) return '';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MarketRow({ row }: { row: LiveTimeframeRow }) {
  const { market, up, down, timeframe } = row;

  if (!market) {
    return (
      <div className="rounded-lg border border-border/20 bg-secondary/10 p-2.5 flex items-center justify-center min-h-[70px]">
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground font-medium block">{TF_LABELS[timeframe]}</span>
          <span className="text-[9px] text-muted-foreground/50">No open market</span>
        </div>
      </div>
    );
  }

  const upMid = up?.mid ?? up?.lastTrade ?? null;
  const downMid = down?.mid ?? down?.lastTrade ?? null;
  const upPct = upMid != null ? Math.round(upMid * 100) : null;
  const fresh = up?.receivedAt && Date.now() - up.receivedAt < 5000;

  return (
    <a
      href={`https://polymarket.com/event/${market.eventSlug || market.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border/30 bg-secondary/15 p-2.5 hover:border-border/50 transition-colors group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
          {TF_LABELS[timeframe]}
          <span className={cn('w-1 h-1 rounded-full', fresh ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40')} />
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-muted-foreground tabular-nums">{countdown(row.msToExpiry)}</span>
          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-2.5 h-2.5 text-primary" />
            <span className="text-[10px] text-primary font-medium">Up</span>
          </div>
          <span className="text-xs font-mono font-bold text-primary tabular-nums">{fmt(upMid)}</span>
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground tabular-nums">
          <span>bid {fmt(up?.bestBid)}</span>
          <span>ask {fmt(up?.bestAsk)}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TrendingDown className="w-2.5 h-2.5 text-destructive" />
            <span className="text-[10px] text-destructive font-medium">Down</span>
          </div>
          <span className="text-xs font-mono font-bold text-destructive tabular-nums">{fmt(downMid)}</span>
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground tabular-nums">
          <span>bid {fmt(down?.bestBid)}</span>
          <span>ask {fmt(down?.bestAsk)}</span>
        </div>
      </div>

      <div className="mt-2 relative h-1 rounded-full bg-destructive/25 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 left-0 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${upPct ?? 0}%` }}
        />
      </div>
    </a>
  );
}

interface PolymarketSidebarProps {
  selectedCoin: CoinId;
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'idle',
  connecting: 'connecting',
  live: 'live',
  reconnecting: 'reconnecting',
  stale: 'delayed',
  closed: 'closed',
  error: 'error',
};

const PolymarketSidebar = ({ selectedCoin }: PolymarketSidebarProps) => {
  const { rows, status, isDiscovering } = usePolymarketCoinLive(selectedCoin);
  const coinInfo = COINS[selectedCoin];

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1.5 px-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: coinInfo.color }} />
        <span className="text-[10px] font-semibold text-foreground">{coinInfo.symbol} Markets</span>
        <span
          className={cn(
            'ml-auto text-[8px] font-mono uppercase tracking-wide',
            status === 'live' ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {isDiscovering && rows.every((r) => !r.market) ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 flex-1">
          {rows.map((row) => (
            <MarketRow key={row.timeframe} row={row} />
          ))}
        </div>
      )}

      <p className="text-[8px] text-muted-foreground px-1 pt-1 border-t border-border/20">
        Live CLOB book · $0–$1 · Click → Polymarket
      </p>
    </div>
  );
};

export default PolymarketSidebar;
