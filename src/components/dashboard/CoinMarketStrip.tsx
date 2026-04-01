import { motion } from 'framer-motion';
import { ExternalLink, TrendingUp, TrendingDown, Loader2, Zap } from 'lucide-react';
import { CoinId, COINS } from '@/lib/crypto-api';
import { usePolymarketForCoin, UpDownMarket, PolymarketTimeframe } from '@/hooks/usePolymarketPredictions';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const TF_ORDER: PolymarketTimeframe[] = ['5m', '15m', '1h'];
const TF_LABELS: Record<PolymarketTimeframe, string> = { '5m': '5 Min', '15m': '15 Min', '1h': '1 Hour' };

function ProbabilityBar({ upPrice }: { upPrice: number }) {
  const upPct = Math.round(upPrice * 100);
  const downPct = 100 - upPct;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[8px] text-muted-foreground">
        <span className="text-primary font-medium">UP {upPct}%</span>
        <span className="text-destructive font-medium">DOWN {downPct}%</span>
      </div>
      <div className="relative h-1 rounded-full bg-destructive/30 overflow-hidden">
        <motion.div
          className="absolute top-0 bottom-0 left-0 rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${upPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function MarketColumn({ market }: { market: UpDownMarket }) {
  const polyUrl = `https://polymarket.com/event/${market.slug}`;
  const hasClobData = market.upBid !== market.upPrice || market.upAsk !== market.upPrice;

  return (
    <div className="flex-1 min-w-[140px] rounded-lg border border-border/40 bg-secondary/20 p-2.5 flex flex-col gap-2">
      <a
        href={polyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between group hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-foreground">{TF_LABELS[market.timeframe]}</span>
          <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary">LIVE</Badge>
        </div>
        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </a>

      {market.timeRange && (
        <p className="text-[9px] text-muted-foreground font-mono">{market.timeRange}</p>
      )}

      <ProbabilityBar upPrice={market.upPrice} />

      {/* Bid/Ask + Payout grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-1 text-center">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <TrendingUp className="w-2 h-2 text-primary" />
            <p className="text-[8px] text-primary font-medium">UP</p>
          </div>
          {hasClobData ? (
            <>
              <p className="text-[9px] font-mono text-muted-foreground">
                {(market.upBid * 100).toFixed(1)}¢ / {(market.upAsk * 100).toFixed(1)}¢
              </p>
              <p className="text-[10px] font-mono font-bold text-primary">${market.upPayout.toFixed(2)}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-mono font-bold text-primary">{Math.round(market.upPrice * 100)}¢</p>
              <p className="text-[8px] text-primary/70">→ ${market.upPayout.toFixed(2)}</p>
            </>
          )}
        </div>
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-1.5 py-1 text-center">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <TrendingDown className="w-2 h-2 text-destructive" />
            <p className="text-[8px] text-destructive font-medium">DOWN</p>
          </div>
          {hasClobData ? (
            <>
              <p className="text-[9px] font-mono text-muted-foreground">
                {(market.downBid * 100).toFixed(1)}¢ / {(market.downAsk * 100).toFixed(1)}¢
              </p>
              <p className="text-[10px] font-mono font-bold text-destructive">${market.downPayout.toFixed(2)}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-mono font-bold text-destructive">{Math.round(market.downPrice * 100)}¢</p>
              <p className="text-[8px] text-destructive/70">→ ${market.downPayout.toFixed(2)}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyColumn({ timeframe }: { timeframe: PolymarketTimeframe }) {
  return (
    <div className="flex-1 min-w-[140px] rounded-lg border border-border/20 bg-secondary/10 p-2.5 flex flex-col items-center justify-center gap-1 min-h-[100px]">
      <span className="text-[9px] text-muted-foreground font-medium">{TF_LABELS[timeframe]}</span>
      <span className="text-[8px] text-muted-foreground/60">No active market</span>
    </div>
  );
}

interface CoinMarketStripProps {
  selectedCoin: CoinId;
}

const CoinMarketStrip = ({ selectedCoin }: CoinMarketStripProps) => {
  const { data: markets, isLoading } = usePolymarketForCoin(selectedCoin);
  const coinInfo = COINS[selectedCoin];

  const byTimeframe = new Map<PolymarketTimeframe, UpDownMarket>();
  for (const m of markets) {
    byTimeframe.set(m.timeframe, m);
  }

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/10 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-primary" />
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: coinInfo.color }} />
        <h3 className="text-xs font-semibold text-foreground">
          {coinInfo.symbol} Up/Down Markets
        </h3>
        <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/30 text-primary">LIVE</Badge>
        <span className="text-[8px] text-muted-foreground ml-auto hidden sm:inline">Click header → Polymarket ↗</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (
        <div className="flex gap-2 overflow-x-auto">
          {TF_ORDER.map(tf => {
            const market = byTimeframe.get(tf);
            return market ? (
              <MarketColumn key={tf} market={market} />
            ) : (
              <EmptyColumn key={tf} timeframe={tf} />
            );
          })}
        </div>
      )}

      <div className="text-[8px] text-muted-foreground pt-1 border-t border-border/20">
        Bid/Ask in ¢ · Payout = return per $1 if correct
      </div>
    </div>
  );
};

export default CoinMarketStrip;
