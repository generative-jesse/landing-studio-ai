import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { COINS, CoinId, Timeframe, calculatePriceTargets, formatPrice } from "@/lib/crypto-api";
import { usePriceHistory } from "@/hooks/useCryptoData";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PriceChartProps {
  coinId: CoinId;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
}

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '5m', label: '5M' },
  { value: '15m', label: '15M' },
  { value: '1h', label: '1H' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-secondary/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatPrice(payload[0].value)}</p>
    </div>
  );
};

const PriceChart = ({ coinId, timeframe, onTimeframeChange }: PriceChartProps) => {
  const { data, isLoading, isError } = usePriceHistory(coinId, timeframe);
  const coin = COINS[coinId];

  const targets = useMemo(() => {
    if (!data?.length) return null;
    return calculatePriceTargets(data);
  }, [data]);

  const yDomain = useMemo(() => {
    if (!data?.length) return ['auto', 'auto'] as [string, string];
    const prices = data.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coin.color }} />
          <h2 className="text-sm font-semibold text-foreground">{coin.symbol}/USD</h2>
          <span className="text-[10px] text-muted-foreground">{coin.name}</span>
        </div>
        <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200",
                timeframe === tf.value
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-[260px] md:h-[300px] w-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-xs text-destructive">Failed to load chart data. Retrying...</p>
          </div>
        )}
        {data && data.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="h-full w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`gradient-${coinId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={coin.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={coin.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.15)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  orientation="right"
                  domain={yDomain}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatPrice(v)}
                  width={70}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Support/Resistance */}
                {targets && (
                  <>
                    <ReferenceLine
                      y={targets.resistance}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="6 4"
                      strokeOpacity={0.5}
                      label={{ value: `R ${formatPrice(targets.resistance)}`, position: 'left', fill: 'hsl(var(--destructive))', fontSize: 9 }}
                    />
                    <ReferenceLine
                      y={targets.support}
                      stroke="hsl(var(--primary))"
                      strokeDasharray="6 4"
                      strokeOpacity={0.5}
                      label={{ value: `S ${formatPrice(targets.support)}`, position: 'left', fill: 'hsl(var(--primary))', fontSize: 9 }}
                    />
                  </>
                )}

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={coin.color}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${coinId})`}
                  animationDuration={600}
                  dot={false}
                  activeDot={{ r: 3, fill: coin.color, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Compact legend */}
      {targets && (
        <div className="flex items-center gap-4 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-px bg-primary inline-block" /> Support: <span className="text-primary font-medium">{formatPrice(targets.support)}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-px bg-destructive inline-block" /> Resistance: <span className="text-destructive font-medium">{formatPrice(targets.resistance)}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default PriceChart;
