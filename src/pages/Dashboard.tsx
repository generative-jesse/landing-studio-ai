import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Zap } from "lucide-react";
import { CoinId, COIN_IDS, Timeframe } from "@/lib/crypto-api";
import { useCryptoPrices } from "@/hooks/useCryptoData";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";
import PriceCard from "@/components/dashboard/PriceCard";
import PriceChart from "@/components/dashboard/PriceChart";
import MarketStats from "@/components/dashboard/MarketStats";
import CoinMarketStrip from "@/components/dashboard/CoinMarketStrip";
import ApiKeySettings from "@/components/dashboard/ApiKeySettings";

const Dashboard = () => {
  const [selectedCoin, setSelectedCoin] = useState<CoinId>('bitcoin');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const { data: prices, isLoading, dataUpdatedAt } = useCryptoPrices();
  const btcTick = useRealtimePrice('BTC-USD');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-3 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-bold text-xs tracking-tight">PolyMarket</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">LIVE</span>
          </div>
          <div className="flex items-center gap-3">
            {btcTick && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                WS
              </div>
            )}
            {dataUpdatedAt > 0 && (
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                <Activity className="w-3 h-3 text-primary animate-pulse" />
                {new Date(dataUpdatedAt).toLocaleTimeString()}
              </div>
            )}
            <ApiKeySettings />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 py-3 flex flex-col gap-3 flex-1">
        {/* Price Cards Row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-2"
        >
          {COIN_IDS.map((coinId) => (
            <PriceCard
              key={coinId}
              coinId={coinId}
              data={prices?.[coinId]}
              isSelected={selectedCoin === coinId}
              onSelect={setSelectedCoin}
              realtimeTick={coinId === 'bitcoin' ? btcTick : undefined}
            />
          ))}
        </motion.div>

        {/* Chart + Market Stats side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="rounded-xl border border-border/50 bg-secondary/10 p-4"
          >
            <PriceChart
              coinId={selectedCoin}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />
          </motion.div>

          {/* Compact Stats */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="flex flex-col gap-3"
          >
            <MarketStats coinId={selectedCoin} data={prices?.[selectedCoin]} />
            
            {/* Quick Insights */}
            {prices && (
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                <h3 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Insights</h3>
                {(() => {
                  const sorted = COIN_IDS
                    .map(id => ({ id, change: prices[id]?.usd_24h_change ?? 0 }))
                    .sort((a, b) => b.change - a.change);
                  const best = sorted[0];
                  const worst = sorted[sorted.length - 1];
                  return (
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px]">
                        <span className="text-muted-foreground">Top: </span>
                        <span className="text-primary font-medium">
                          {best.id.charAt(0).toUpperCase() + best.id.slice(1)} ({best.change >= 0 ? '+' : ''}{best.change.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="text-[10px]">
                        <span className="text-muted-foreground">Low: </span>
                        <span className="text-destructive font-medium">
                          {worst.id.charAt(0).toUpperCase() + worst.id.slice(1)} ({worst.change >= 0 ? '+' : ''}{worst.change.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </motion.div>
        </div>

        {/* Polymarket Up/Down Strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <CoinMarketStrip selectedCoin={selectedCoin} />
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
