import { CoinId, CoinPrice, COINS, formatVolume, formatMarketCap } from "@/lib/crypto-api";
import { Activity, BarChart3, DollarSign, TrendingUp } from "lucide-react";

interface MarketStatsProps {
  coinId: CoinId;
  data?: CoinPrice;
}

const StatItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/20 border border-border/30">
    <Icon className="w-3 h-3 text-muted-foreground" />
    <span className="text-[10px] text-muted-foreground">{label}</span>
    <span className="text-[10px] font-medium text-foreground ml-auto">{value}</span>
  </div>
);

const MarketStats = ({ coinId, data }: MarketStatsProps) => {
  const coin = COINS[coinId];

  if (!data) {
    return (
      <div className="p-3 rounded-xl border border-border/50 bg-secondary/10">
        <p className="text-[10px] text-muted-foreground">Loading market data...</p>
      </div>
    );
  }

  const change = data.usd_24h_change ?? 0;

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/10 p-3">
      <h3 className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">{coin.name} Market Data</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatItem icon={DollarSign} label="Market Cap" value={formatMarketCap(data.usd_market_cap)} />
        <StatItem icon={BarChart3} label="24h Volume" value={formatVolume(data.usd_24h_vol)} />
        <StatItem icon={TrendingUp} label="24h Change" value={`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`} />
        <StatItem icon={Activity} label="Vol/MCap" value={`${((data.usd_24h_vol / data.usd_market_cap) * 100).toFixed(2)}%`} />
      </div>
    </div>
  );
};

export default MarketStats;
