import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePolymarketAll, PolymarketMarket, PolymarketCoin, PolymarketTimeframe } from '@/hooks/usePolymarketPredictions';
import { useCryptoPrices } from '@/hooks/useCryptoData';
import { COINS, CoinId, formatPrice } from '@/lib/crypto-api';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'by-timeframe' | 'by-coin';

const TIMEFRAME_ORDER: PolymarketTimeframe[] = ['5 Min', '15 Min', 'Hourly', '4 Hour', 'Daily'];
const COIN_ORDER: PolymarketCoin[] = ['bitcoin', 'ethereum', 'solana', 'xrp'];

const COIN_TO_COINGECKO: Record<PolymarketCoin, CoinId> = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  solana: 'solana',
  xrp: 'ripple',
};

function DistanceGauge({ currentPrice, targetPrice }: { currentPrice: number; targetPrice: number }) {
  const diff = targetPrice - currentPrice;
  const pctDiff = (diff / currentPrice) * 100;
  const isAbove = diff > 0;

  // Clamp visual to -10% to +10%
  const clampedPct = Math.max(-10, Math.min(10, pctDiff));
  const fillPct = ((clampedPct + 10) / 20) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>-10%</span>
        <span className={cn(
          "font-mono font-semibold text-[11px]",
          isAbove ? "text-primary" : "text-destructive"
        )}>
          {isAbove ? '+' : ''}{pctDiff.toFixed(2)}%
        </span>
        <span>+10%</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/30" />
        <motion.div
          className={cn(
            "absolute top-0 bottom-0 rounded-full",
            isAbove ? "bg-primary" : "bg-destructive"
          )}
          initial={{ width: 0 }}
          animate={{
            left: isAbove ? '50%' : `${fillPct}%`,
            width: isAbove ? `${fillPct - 50}%` : `${50 - fillPct}%`,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function MarketCard({ market, currentPrice }: { market: PolymarketMarket; currentPrice?: number }) {
  const coin = COINS[COIN_TO_COINGECKO[market.coin]];
  const diff = currentPrice ? ((market.targetPrice - currentPrice) / currentPrice) * 100 : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-lg border border-border/40 bg-secondary/20 p-3 flex flex-col gap-2.5 hover:border-border/60 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coin.color }} />
          <span className="text-xs font-semibold text-foreground">{market.coinSymbol}</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-border/40 text-muted-foreground">
            {market.timeframe}
          </Badge>
        </div>
        <span className="flex items-center gap-0.5 text-[9px] text-primary">
          <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Target Price */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground">Price to Beat</p>
          <p className="text-sm font-mono font-bold text-foreground">{formatPrice(market.targetPrice)}</p>
        </div>
        {diff !== null && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            diff > 0 ? "text-primary" : "text-destructive"
          )}>
            {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(diff).toFixed(2)}% away
          </div>
        )}
      </div>

      {/* Distance gauge */}
      {currentPrice && (
        <DistanceGauge currentPrice={currentPrice} targetPrice={market.targetPrice} />
      )}

      {/* Payout Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-primary/10 border border-primary/20 px-2 py-1.5 text-center">
          <p className="text-[9px] text-muted-foreground mb-0.5">Up</p>
          <p className="text-xs font-mono font-bold text-primary">{Math.round(market.yesPrice * 100)}¢</p>
          <p className="text-[9px] text-primary/70">→ ${market.yesPayout.toFixed(2)}</p>
        </div>
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-2 py-1.5 text-center">
          <p className="text-[9px] text-muted-foreground mb-0.5">Down</p>
          <p className="text-xs font-mono font-bold text-destructive">{Math.round(market.noPrice * 100)}¢</p>
          <p className="text-[9px] text-destructive/70">→ ${market.noPayout.toFixed(2)}</p>
        </div>
      </div>
    </motion.div>
  );
}

const PolymarketGrid = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('by-timeframe');
  const [selectedTimeframe, setSelectedTimeframe] = useState<PolymarketTimeframe>('5 Min');
  const [selectedCoin, setSelectedCoin] = useState<PolymarketCoin>('bitcoin');
  const { data: markets, isLoading, isError } = usePolymarketAll();
  const { data: prices } = useCryptoPrices();

  const getCurrentPrice = (coin: PolymarketCoin): number | undefined => {
    const cgId = COIN_TO_COINGECKO[coin];
    return prices?.[cgId]?.usd;
  };

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Polymarket Odds</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">LIVE</Badge>
        </div>

        {/* View Toggle */}
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

      {/* Filter Tabs */}
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
              {tf}
            </button>
          ))
        ) : (
          availableCoins.map(coin => {
            const info = COINS[COIN_TO_COINGECKO[coin]];
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

      {/* Loading/Error */}
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

      {/* Market Cards Grid */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredMarkets.map(m => (
              <MarketCard
                key={m.conditionId}
                market={m}
                currentPrice={getCurrentPrice(m.coin)}
              />
            ))}
          </AnimatePresence>
          {filteredMarkets.length === 0 && (
            <div className="col-span-full text-center py-6">
              <p className="text-xs text-muted-foreground">No active markets for this selection.</p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border/20">
        <span>Prices = cost per share · Payout = return per $1 if correct</span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Gauge shows distance to target
        </span>
      </div>
    </div>
  );
};

export default PolymarketGrid;
