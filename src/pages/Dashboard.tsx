import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Zap } from "lucide-react";
import { CoinId, COIN_IDS, Timeframe } from "@/lib/crypto-api";
import { useCryptoPrices } from "@/hooks/useCryptoData";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";
import { usePolymarketPredictions } from "@/hooks/usePolymarketPredictions";
import PriceCard from "@/components/dashboard/PriceCard";
import PriceChart from "@/components/dashboard/PriceChart";
import MarketStats from "@/components/dashboard/MarketStats";
import SentimentTable from "@/components/dashboard/SentimentTable";
import ApiKeySettings from "@/components/dashboard/ApiKeySettings";

const Dashboard = () => {
  const [selectedCoin, setSelectedCoin] = useState<CoinId>('bitcoin');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const { data: prices, isLoading, dataUpdatedAt } = useCryptoPrices();
  const btcTick = useRealtimePrice('BTC-USD');
  const { data: predictions } = usePolymarketPredictions();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm tracking-tight">PolyMarket</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium ml-1">LIVE</span>
          </div>
          <div className="flex items-center gap-3">
            {btcTick && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                WS Connected
              </div>
            )}
            {dataUpdatedAt > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Activity className="w-3 h-3 text-primary animate-pulse" />
                Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
              </div>
            )}
            <ApiKeySettings />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Price Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
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

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="lg:col-span-3 rounded-xl border border-border/50 bg-secondary/10 p-5"
          >
            <PriceChart
              coinId={selectedCoin}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              predictions={selectedCoin === 'bitcoin' ? predictions : undefined}
            />
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="flex flex-col gap-6"
          >
            <MarketStats coinId={selectedCoin} data={prices?.[selectedCoin]} />

            {/* Quick Insights */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">Quick Insights</h3>
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 flex flex-col gap-3">
                {prices && (() => {
                  const sorted = COIN_IDS
                    .map(id => ({ id, change: prices[id]?.usd_24h_change ?? 0 }))
                    .sort((a, b) => b.change - a.change);
                  const best = sorted[0];
                  const worst = sorted[sorted.length - 1];
                  return (
                    <>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Top performer: </span>
                        <span className="text-primary font-medium">
                          {best.id.charAt(0).toUpperCase() + best.id.slice(1)} ({best.change >= 0 ? '+' : ''}{best.change.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Underperformer: </span>
                        <span className="text-destructive font-medium">
                          {worst.id.charAt(0).toUpperCase() + worst.id.slice(1)} ({worst.change >= 0 ? '+' : ''}{worst.change.toFixed(2)}%)
                        </span>
                      </div>
                    </>
                  );
                })()}
                {!prices && <p className="text-xs text-muted-foreground">Loading insights...</p>}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sentiment Table — full width below chart */}
        {selectedCoin === 'bitcoin' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <SentimentTable />
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
