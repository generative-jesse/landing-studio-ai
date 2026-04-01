import { useState, useMemo, useEffect, useRef } from "react";
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
import { COINS, CoinId, Timeframe, calculatePriceTargets, formatPrice, ChartPoint } from "@/lib/crypto-api";
import { usePriceHistory } from "@/hooks/useCryptoData";
import { useRealtimePrice, RealtimeTick } from "@/hooks/useRealtimePrice";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PriceChartProps {
  coinId: CoinId;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  realtimeTick?: RealtimeTick | null;
}

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: '5m', label: '5M' },
  { value: '15m', label: '15M' },
  { value: '1h', label: '1H' },
];

const WS_PRODUCT_MAP: Record<CoinId, string> = {
  bitcoin: 'BTC-USD',
  ethereum: 'ETH-USD',
  solana: 'SOL-USD',
  ripple: 'XRP-USD',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-secondary/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{formatPrice(payload[0].value)}</p>
    </div>
  );
};

const PriceChart = ({ coinId, timeframe, onTimeframeChange, realtimeTick }: PriceChartProps) => {
  const { data: historicalData, isLoading, isError } = usePriceHistory(coinId, timeframe);
  const coin = COINS[coinId];
  const [livePoints, setLivePoints] = useState<ChartPoint[]>([]);
  const lastTickRef = useRef<number>(0);

  // Reset live points when coin or timeframe changes
  useEffect(() => {
    setLivePoints([]);
  }, [coinId, timeframe]);

  // Append real-time ticks to chart data (throttled to ~1s)
  useEffect(() => {
    if (!realtimeTick || coinId !== 'bitcoin') return;
    const now = Date.now();
    if (now - lastTickRef.current < 1000) return;
    lastTickRef.current = now;

    const point: ChartPoint = {
      time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: now,
      price: realtimeTick.price,
    };

    setLivePoints(prev => {
      const updated = [...prev, point];
      // Keep last 60 live points max
      return updated.slice(-60);
    });
  }, [realtimeTick, coinId]);

  const chartData = useMemo(() => {
    if (!historicalData?.length) return livePoints;
    // Merge historical + live, trimming historical tail if we have live data
    if (livePoints.length === 0) return historicalData;
    // Show last portion of historical + all live
    const maxHistorical = Math.max(0, historicalData.length - livePoints.length);
    return [...historicalData.slice(0, maxHistorical), ...livePoints];
  }, [historicalData, livePoints]);

  const targets = useMemo(() => {
    if (!chartData?.length) return null;
    return calculatePriceTargets(chartData);
  }, [chartData]);

  const yDomain = useMemo(() => {
    if (!chartData?.length) return ['auto', 'auto'] as [string, string];
    const prices = chartData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.08;
    return [min - padding, max + padding];
  }, [chartData]);

  const currentPrice = useMemo(() => {
    if (realtimeTick && coinId === 'bitcoin') return realtimeTick.price;
    if (chartData.length > 0) return chartData[chartData.length - 1].price;
    return null;
  }, [realtimeTick, chartData, coinId]);

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coin.color }} />
          <h2 className="text-sm font-semibold text-foreground">{coin.symbol}/USD</h2>
          {currentPrice && (
            <span className="text-sm font-mono font-bold text-foreground">{formatPrice(currentPrice)}</span>
          )}
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
      <div className="relative h-[280px] w-full">
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
        {chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`gradient-${coinId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={coin.color} stopOpacity={0.2} />
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
                  width={75}
                />
                <Tooltip content={<CustomTooltip />} />

                {targets && (
                  <>
                    <ReferenceLine y={targets.resistance} stroke="hsl(var(--destructive))" strokeDasharray="6 4" strokeOpacity={0.4} />
                    <ReferenceLine y={targets.support} stroke="hsl(var(--primary))" strokeDasharray="6 4" strokeOpacity={0.4} />
                  </>
                )}

                {/* Current price line */}
                {currentPrice && (
                  <ReferenceLine
                    y={currentPrice}
                    stroke={coin.color}
                    strokeDasharray="2 2"
                    strokeOpacity={0.8}
                  />
                )}

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={coin.color}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${coinId})`}
                  animationDuration={300}
                  isAnimationActive={livePoints.length === 0}
                  dot={false}
                  activeDot={{ r: 3, fill: coin.color, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PriceChart;
