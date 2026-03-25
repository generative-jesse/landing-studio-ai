import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePolymarketAll, UpDownMarket, PolymarketTimeframe } from '@/hooks/usePolymarketPredictions';
import { COINS, CoinId } from '@/lib/crypto-api';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Zap, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'by-timeframe' | 'by-coin';

const TIMEFRAME_ORDER: PolymarketTimeframe[] = ['5m', '15m', '1h'];
const COIN_ORDER: CoinId[] = ['bitcoin', 'ethereum', 'solana', 'ripple'];
const TF_LABELS: Record<PolymarketTimeframe, string> = { '5m': '5 Min', '15m': '15 Min', '1h': '1 Hour' };

function MarketCard({ market }: { market: UpDownMarket }) {
  const coin = COINS[market.coin];
  const polyUrl = `https://polymarket.com/event/${market.slug}`;
  const upPct = Math.round(market.upPrice * 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-lg border border-border/40 bg-secondary/20 p-3 flex flex-col gap-2.5 hover:border-border/60 transition-colors"
    >
      <a href={polyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coin.color }} />
          <span className="text-xs font-semibold text-foreground">{coin.symbol}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-border/40 text-muted-foreground">
            {TF_LABELS[market.timeframe]}
          </Badge>
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
      </a>

      {market.timeRange && (
        <p className="text-[10px] text-muted-foreground font-mono">{market.timeRange}</p>
      )}

      {/* Probability bar */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-primary font-medium">UP {upPct}%</span>
          <span className="text-destructive font-medium">DOWN {100 - upPct}%</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-destructive/30 overflow-hidden">
          <motion.div
            className="absolute top-0 bottom-0 left-0 rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${upPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-center">
          <p className="text-[9px] text-muted-foreground mb-0.5">Up</p>
          <p className="text-xs font-mono font-bold text-primary">{upPct}¢</p>
          <p className="text-[9px] text-primary/70">→ ${market.upPayout.toFixed(2)}</p>
        </div>
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1.5 text-center">
          <p className="text-[9px] text-muted-foreground mb-0.5">Down</p>
          <p className="text-xs font-mono font-bold text-destructive">{100 - upPct}¢</p>
          <p className="text-[9px] text-destructive/70">→ ${market.downPayout.toFixed(2)}</p>
        </div>
      </div>
    </motion.div>
  );
}

const PolymarketGrid = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('by-timeframe');
  const [selectedTimeframe, setSelectedTimeframe] = useState<PolymarketTimeframe>('5m');
  const [selectedCoin, setSelectedCoin] = useState<CoinId>('bitcoin');
  const { data: markets, isLoading, isError } = usePolymarketAll();

  const filteredMarkets = useMemo(() => {
    if (!markets) return [];
    if (viewMode === 'by-timeframe') {
      return markets
        .filter(m => m.timeframe === selectedTimeframe)
        .sort((a, b) => COIN_ORDER.indexOf(a.coin) - COIN_ORDER.indexOf(b.coin));
    }
    return markets
      .filter(m => m.coin === selectedCoin)
      .sort((a, b) => TIMEFRAME_ORDER.indexOf(a.timeframe) - TIMEFRAME_ORDER.indexOf(b.timeframe));
  }, [markets, viewMode, selectedTimeframe, selectedCoin]);

  const availableTimeframes = useMemo(() => {
    if (!markets) return [];
    return TIMEFRAME_ORDER.filter(tf => markets.some(m => m.timeframe === tf));
  }, [markets]);

  const availableCoins = useMemo(() => {
    if (!markets) return [];
    return COIN_ORDER.filter(c => markets.some(m => m.coin === c));
  }, [markets]);

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/10 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Polymarket Odds</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">LIVE</Badge>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('by-timeframe')}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
              viewMode === 'by-timeframe' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Compare Coins
          </button>
          <button
            onClick={() => setViewMode('by-coin')}
            className={cn(
              "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
              viewMode === 'by-coin' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Compare Timeframes
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {viewMode === 'by-timeframe' ? (
          availableTimeframes.map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
                selectedTimeframe === tf
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-secondary/30 text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              {TF_LABELS[tf]}
            </button>
          ))
        ) : (
          availableCoins.map(coin => {
            const info = COINS[coin];
            return (
              <button
                key={coin}
                onClick={() => setSelectedCoin(coin)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1.5",
                  selectedCoin === coin
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-secondary/30 text-muted-foreground hover:text-foreground border border-transparent"
                )}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                {info.symbol}
              </button>
            );
          })
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {isError && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Unable to fetch Polymarket data. Retrying...
        </p>
      )}

      {!isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredMarkets.map(m => (
              <MarketCard key={`${m.coin}-${m.timeframe}`} market={m} />
            ))}
          </AnimatePresence>
          {filteredMarkets.length === 0 && (
            <div className="col-span-full text-center py-6">
              <p className="text-xs text-muted-foreground">No active markets for this selection.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border/20">
        <span>Prices = cost per share · Payout = return per $1 if correct</span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Click any card to view on Polymarket
        </span>
      </div>
    </div>
  );
};

export default PolymarketGrid;
