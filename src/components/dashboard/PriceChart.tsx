import { useState, useMemo, useEffect } from "react";
import { COINS, CoinId, Timeframe, formatPrice } from "@/lib/crypto-api";
import { usePriceHistory } from "@/hooks/useCryptoData";
import { RealtimeTick } from "@/hooks/useRealtimePrice";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  type Candle,
  CandlestickChart,
  CandlestickChartLegend,
  CandlestickChartPlot,
} from "@/components/charts/candlestick-chart";

interface PriceChartProps {
  coinId: CoinId;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  realtimeTick?: RealtimeTick | null;
}

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "5m", label: "5M" },
  { value: "15m", label: "15M" },
  { value: "1h", label: "1H" },
];

/** Candle width per timeframe, in ms. */
const BUCKET_MS: Record<Timeframe, number> = {
  "5m": 15_000,
  "15m": 60_000,
  "1h": 5 * 60_000,
};

const label = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Fold real price samples into OHLC candles by time bucket. Volume = sample count (activity). */
function toCandles(points: { timestamp: number; price: number }[], bucket: number): Candle[] {
  const map = new Map<number, Candle>();
  for (const p of points) {
    const start = Math.floor(p.timestamp / bucket) * bucket;
    const c = map.get(start);
    if (!c) {
      map.set(start, { id: String(start), label: label(start), open: p.price, high: p.price, low: p.price, close: p.price, volume: 1 });
    } else {
      c.high = Math.max(c.high, p.price);
      c.low = Math.min(c.low, p.price);
      c.close = p.price;
      c.volume += 1;
    }
  }
  return [...map.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

const PriceChart = ({ coinId, timeframe, onTimeframeChange, realtimeTick }: PriceChartProps) => {
  const { data: historicalData, isLoading, isError } = usePriceHistory(coinId, timeframe);
  const coin = COINS[coinId];
  const [ticks, setTicks] = useState<{ timestamp: number; price: number }[]>([]);

  useEffect(() => setTicks([]), [coinId, timeframe]);

  useEffect(() => {
    if (!realtimeTick || coinId !== "bitcoin") return;
    setTicks((prev) => [...prev, { timestamp: Date.now(), price: realtimeTick.price }].slice(-3000));
  }, [realtimeTick, coinId]);

  const candles = useMemo(() => {
    const hist = historicalData ?? [];
    const lastHist = hist.length ? hist[hist.length - 1].timestamp : 0;
    const merged = [...hist, ...ticks.filter((t) => t.timestamp > lastHist)];
    if (merged.length < 2) return toCandles(merged, BUCKET_MS[timeframe]);
    // Bucket size adapts so history sampled sparsely still forms ~48 real OHLC candles.
    const span = merged[merged.length - 1].timestamp - merged[0].timestamp;
    const bucket = Math.max(BUCKET_MS[timeframe], Math.ceil(span / 48));
    return toCandles(merged, bucket).slice(-60);
  }, [historicalData, ticks, timeframe]);

  const currentPrice =
    realtimeTick && coinId === "bitcoin" ? realtimeTick.price : candles[candles.length - 1]?.close ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: coin.color }} />
          <h2 className="text-sm font-semibold text-foreground">{coin.symbol}/USD</h2>
          {currentPrice != null && (
            <span className="text-sm font-mono font-bold text-foreground tabular-nums">{formatPrice(currentPrice)}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors duration-150",
                timeframe === tf.value ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-[320px] w-full">
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
        {candles.length > 0 && (
          <CandlestickChart
            candles={candles}
            lastPrice={currentPrice ?? undefined}
            label={`${coin.symbol} / USD live candles`}
            formatPrice={(v) => formatPrice(v)}
            formatVolume={(v) => `${v} ticks`}
          >
            <CandlestickChartLegend />
            <CandlestickChartPlot height={300} className="mt-2" />
          </CandlestickChart>
        )}
      </div>
    </div>
  );
};

export default PriceChart;
