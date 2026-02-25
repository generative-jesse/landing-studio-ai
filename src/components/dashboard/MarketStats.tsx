import { CoinId, CoinPrice, COINS, formatVolume, formatMarketCap } from "@/lib/crypto-api";
import { Activity, BarChart3, DollarSign, TrendingUp } from "lucide-react";

interface MarketStatsProps {
  coinId: CoinId;
  data?: CoinPrice;
}

const StatRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs">{label}</span>
    </div>
    <span className="text-xs font-medium text-foreground">{value}</span>
  </div>
);

const MarketStats = ({ coinId, data }: MarketStatsProps) => {
  const coin = COINS[coinId];
  
  if (!data) {
    return (
      <div className="p-4 rounded-xl border border-border/50 bg-secondary/20">
        <p className="text-xs text-muted-foreground">Loading market data...</p>
      </div>
    );
  }

  const change = data.usd_24h_change ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{coin.name} Market Data</h3>
      <div className="rounded-xl border border-border/50 bg-secondary/20 px-4">
        <StatRow icon={DollarSign} label="Market Cap" value={formatMarketCap(data.usd_market_cap)} />
        <StatRow icon={BarChart3} label="24h Volume" value={formatVolume(data.usd_24h_vol)} />
        <StatRow icon={TrendingUp} label="24h Change" value={`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`} />
        <StatRow icon={Activity} label="Vol/MCap Ratio" value={`${((data.usd_24h_vol / data.usd_market_cap) * 100).toFixed(2)}%`} />
      </div>
    </div>
  );
};

export default MarketStats;
