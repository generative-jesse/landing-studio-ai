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
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span className="text-primary">UP {upPct}%</span>
        <span className="text-destructive">DOWN {downPct}%</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-destructive/30 overflow-hidden">
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

  return (
    <div className="flex-1 rounded-lg border border-border/40 bg-secondary/20 p-3 flex flex-col gap-2.5">
      {/* Clickable header */}
      <a
        href={polyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between group hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-foreground">{TF_LABELS[market.timeframe]}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">LIVE</Badge>
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
      </a>

      {/* Time Range */}
      {market.timeRange && (
        <p className="text-[10px] text-muted-foreground font-mono">{market.timeRange}</p>
      )}

      {/* Probability Bar */}
      <ProbabilityBar upPrice={market.upPrice} />

      {/* Up / Down payouts */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <TrendingUp className="w-2.5 h-2.5 text-primary" />
            <p className="text-[9px] text-primary font-medium">UP</p>
          </div>
          <p className="text-xs font-mono font-bold text-primary">{Math.round(market.upPrice * 100)}¢</p>
          <p className="text-[9px] text-primary/70">→ ${market.upPayout.toFixed(2)}</p>
        </div>
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <TrendingDown className="w-2.5 h-2.5 text-destructive" />
            <p className="text-[9px] text-destructive font-medium">DOWN</p>
          </div>
          <p className="text-xs font-mono font-bold text-destructive">{Math.round(market.downPrice * 100)}¢</p>
          <p className="text-[9px] text-destructive/70">→ ${market.downPayout.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyColumn({ timeframe }: { timeframe: PolymarketTimeframe }) {
  return (
    <div className="flex-1 rounded-lg border border-border/20 bg-secondary/10 p-3 flex flex-col items-center justify-center gap-1 min-h-[140px]">
      <span className="text-[10px] text-muted-foreground font-medium">{TF_LABELS[timeframe]}</span>
      <span className="text-[9px] text-muted-foreground/60">No active market</span>
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
    <div className="rounded-xl border border-border/50 bg-secondary/10 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coinInfo.color }} />
        <h3 className="text-sm font-semibold text-foreground">
          {coinInfo.symbol} Polymarket Up/Down
        </h3>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">LIVE</Badge>
        <span className="text-[10px] text-muted-foreground ml-auto">Click to open on Polymarket ↗</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (
        <div className="flex gap-3">
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

      <div className="text-[9px] text-muted-foreground pt-1 border-t border-border/20">
        Prices = cost per share · Payout = return per $1 if correct
      </div>
    </div>
  );
};

export default CoinMarketStrip;
