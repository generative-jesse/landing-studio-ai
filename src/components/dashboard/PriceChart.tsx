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
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: coin.color }} />
          <h2 className="text-lg font-semibold text-foreground">{coin.symbol}/USD</h2>
          <span className="text-xs text-muted-foreground">{coin.name}</span>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all duration-200",
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
      <div className="relative h-[400px] w-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-sm text-destructive">Failed to load chart data. Retrying...</p>
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
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`gradient-${coinId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={coin.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={coin.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(0 0% 12%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={60}
                />
                <YAxis
                  domain={yDomain}
                  tick={{ fill: 'hsl(0 0% 45%)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatPrice(v)}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Price targets */}
                {targets && (
                  <>
                    <ReferenceLine
                      y={targets.resistance}
                      stroke="hsl(0 84% 60%)"
                      strokeDasharray="6 4"
                      strokeOpacity={0.6}
                      label={{
                        value: `R ${formatPrice(targets.resistance)}`,
                        position: 'right',
                        fill: 'hsl(0 84% 60%)',
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      y={targets.mid}
                      stroke="hsl(0 0% 45%)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.4}
                      label={{
                        value: `Mid ${formatPrice(targets.mid)}`,
                        position: 'right',
                        fill: 'hsl(0 0% 45%)',
                        fontSize: 10,
                      }}
                    />
                    <ReferenceLine
                      y={targets.support}
                      stroke="hsl(142 84% 58%)"
                      strokeDasharray="6 4"
                      strokeOpacity={0.6}
                      label={{
                        value: `S ${formatPrice(targets.support)}`,
                        position: 'right',
                        fill: 'hsl(142 84% 58%)',
                        fontSize: 10,
                      }}
                    />
                  </>
                )}

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={coin.color}
                  strokeWidth={2}
                  fill={`url(#gradient-${coinId})`}
                  animationDuration={800}
                  dot={false}
                  activeDot={{ r: 4, fill: coin.color, stroke: 'hsl(0 0% 4%)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>

      {/* Price targets legend */}
      {targets && (
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-[2px] bg-primary" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(142 84% 58%) 0, hsl(142 84% 58%) 6px, transparent 6px, transparent 10px)' }} />
            <span className="text-muted-foreground">Support: <span className="text-primary font-medium">{formatPrice(targets.support)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-[2px]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(0 84% 60%) 0, hsl(0 84% 60%) 6px, transparent 6px, transparent 10px)' }} />
            <span className="text-muted-foreground">Resistance: <span className="text-destructive font-medium">{formatPrice(targets.resistance)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceChart;
