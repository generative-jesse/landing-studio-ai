import { ExternalLink, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { CoinId, COINS } from '@/lib/crypto-api';
import { usePolymarketForCoin, UpDownMarket, PolymarketTimeframe } from '@/hooks/usePolymarketPredictions';
import { cn } from '@/lib/utils';

const TF_ORDER: PolymarketTimeframe[] = ['5m', '15m', '1h'];
const TF_LABELS: Record<PolymarketTimeframe, string> = { '5m': '5 Min', '15m': '15 Min', '1h': '1 Hour' };

function MarketRow({ market }: { market: UpDownMarket }) {
  const polyUrl = `https://polymarket.com/event/${market.slug}`;

  return (
    <a
      href={polyUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border/30 bg-secondary/15 p-2.5 hover:border-border/50 transition-colors group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-foreground">{TF_LABELS[market.timeframe]}</span>
        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      {market.timeRange && (
        <p className="text-[9px] text-muted-foreground font-mono mb-2">{market.timeRange}</p>
      )}
      {/* Up / Down prices — raw $0-$1 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-2.5 h-2.5 text-primary" />
            <span className="text-[10px] text-primary font-medium">Up</span>
          </div>
          <span className="text-xs font-mono font-bold text-primary">
            ${market.upPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TrendingDown className="w-2.5 h-2.5 text-destructive" />
            <span className="text-[10px] text-destructive font-medium">Down</span>
          </div>
          <span className="text-xs font-mono font-bold text-destructive">
            ${market.downPrice.toFixed(2)}
          </span>
        </div>
      </div>
      {/* Thin probability bar */}
      <div className="mt-2 relative h-1 rounded-full bg-destructive/25 overflow-hidden">
        <div
          className="absolute top-0 bottom-0 left-0 rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.round(market.upPrice * 100)}%` }}
        />
      </div>
    </a>
  );
}

function EmptyRow({ timeframe }: { timeframe: PolymarketTimeframe }) {
  return (
    <div className="rounded-lg border border-border/20 bg-secondary/10 p-2.5 flex items-center justify-center min-h-[70px]">
      <div className="text-center">
        <span className="text-[10px] text-muted-foreground font-medium block">{TF_LABELS[timeframe]}</span>
        <span className="text-[9px] text-muted-foreground/50">No market</span>
      </div>
    </div>
  );
}

interface PolymarketSidebarProps {
  selectedCoin: CoinId;
}

const PolymarketSidebar = ({ selectedCoin }: PolymarketSidebarProps) => {
  const { data: markets, isLoading } = usePolymarketForCoin(selectedCoin);
  const coinInfo = COINS[selectedCoin];

  const byTimeframe = new Map<PolymarketTimeframe, UpDownMarket>();
  for (const m of markets) {
    byTimeframe.set(m.timeframe, m);
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1.5 px-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: coinInfo.color }} />
        <span className="text-[10px] font-semibold text-foreground">{coinInfo.symbol} Markets</span>
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse ml-auto" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 flex-1">
          {TF_ORDER.map(tf => {
            const market = byTimeframe.get(tf);
            return market ? (
              <MarketRow key={tf} market={market} />
            ) : (
              <EmptyRow key={tf} timeframe={tf} />
            );
          })}
        </div>
      )}

      <p className="text-[8px] text-muted-foreground px-1 pt-1 border-t border-border/20">
        Prices $0–$1 · Click → Polymarket
      </p>
    </div>
  );
};

export default PolymarketSidebar;
