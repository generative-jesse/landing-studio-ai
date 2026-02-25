import { motion } from "framer-motion";
import { COINS, CoinId, CoinPrice, formatPrice } from "@/lib/crypto-api";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceCardProps {
  coinId: CoinId;
  data?: CoinPrice;
  isSelected: boolean;
  onSelect: (id: CoinId) => void;
}

const PriceCard = ({ coinId, data, isSelected, onSelect }: PriceCardProps) => {
  const coin = COINS[coinId];
  const change = data?.usd_24h_change ?? 0;
  const isPositive = change >= 0;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(coinId)}
      className={cn(
        "relative flex flex-col gap-1 p-4 rounded-xl border transition-all duration-300 text-left w-full",
        isSelected
          ? "border-primary/40 bg-primary/5"
          : "border-border/50 bg-secondary/30 hover:border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: coin.color }}
          />
          <span className="text-xs text-muted-foreground font-medium">{coin.symbol}</span>
        </div>
        {data && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            isPositive ? "text-primary" : "text-destructive"
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change).toFixed(2)}%
          </div>
        )}
      </div>
      <span className="text-lg font-semibold tracking-tight text-foreground">
        {data ? formatPrice(data.usd) : '—'}
      </span>
      <span className="text-[10px] text-muted-foreground">{coin.name}</span>
    </motion.button>
  );
};

export default PriceCard;
