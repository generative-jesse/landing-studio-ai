import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Zap } from "lucide-react";
import { CoinId, COIN_IDS, Timeframe } from "@/lib/crypto-api";
import { useCryptoPrices } from "@/hooks/useCryptoData";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";
import PriceCard from "@/components/dashboard/PriceCard";
import PriceChart from "@/components/dashboard/PriceChart";
import MarketStats from "@/components/dashboard/MarketStats";
import PolymarketSidebar from "@/components/dashboard/PolymarketSidebar";
import ApiKeySettings from "@/components/dashboard/ApiKeySettings";

const Dashboard = () => {
  const [selectedCoin, setSelectedCoin] = useState<CoinId>('bitcoin');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const { data: prices, dataUpdatedAt } = useCryptoPrices();
  const btcTick = useRealtimePrice('BTC-USD');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-3 h-11 flex items-center justify-between">
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
                <Activity className="w-3 h-3 text-primary" />
                {new Date(dataUpdatedAt).toLocaleTimeString()}
              </div>
            )}
            <ApiKeySettings />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 py-3 flex flex-col gap-3 flex-1">
        {/* Price Cards */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
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

        {/* Chart (left) + Polymarket prices (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-3">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="rounded-xl border border-border/50 bg-secondary/10 p-3"
          >
            <PriceChart
              coinId={selectedCoin}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              realtimeTick={selectedCoin === 'bitcoin' ? btcTick : undefined}
            />
          </motion.div>

          {/* Polymarket Prices - right side */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="rounded-xl border border-border/50 bg-secondary/10 p-3"
          >
            <PolymarketSidebar selectedCoin={selectedCoin} />
          </motion.div>
        </div>

        {/* Market Data - under the chart */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
        >
          <MarketStats coinId={selectedCoin} data={prices?.[selectedCoin]} />
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
