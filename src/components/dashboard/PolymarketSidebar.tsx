import { Loader2 } from "lucide-react";
import { CoinId, COINS } from "@/lib/crypto-api";
import { usePolymarketCoinLive, LiveTimeframeRow } from "@/hooks/usePolymarketCoinLive";
import { PolyTimeframe } from "@/lib/polymarket/types";
import { PredictionMarketCard } from "@/components/motion/prediction-market-card";
import { cn } from "@/lib/utils";

const TF_LABELS: Record<PolyTimeframe, string> = { "5m": "5 Min", "15m": "15 Min", "1h": "1 Hour" };

const fmt = (p: number | null | undefined) => (p == null ? "—" : `$${p.toFixed(2)}`);

function countdown(ms: number | null) {
  if (ms == null || ms < 0) return "Settling";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} left`;
}

function MarketCard({ row, symbol }: { row: LiveTimeframeRow; symbol: string }) {
  const { market, up, down, timeframe } = row;
  if (!market) {
    return (
      <div className="rounded-xl border border-border/20 bg-secondary/10 p-3 text-center">
        <span className="text-[11px] font-medium text-muted-foreground block">{TF_LABELS[timeframe]}</span>
        <span className="text-[10px] text-muted-foreground/60">No open market</span>
      </div>
    );
  }
  const upMid = up?.mid ?? up?.lastTrade ?? null;
  const downMid = down?.mid ?? down?.lastTrade ?? null;
  const url = `https://polymarket.com/event/${market.eventSlug || market.slug}`;
  const fresh = !!up?.receivedAt && Date.now() - up.receivedAt < 5000;

  return (
    <div className="flex flex-col gap-1">
      <PredictionMarketCard
        title={`${symbol} Up or Down · ${TF_LABELS[timeframe]}`}
        category="Crypto"
        status={countdown(row.msToExpiry)}
        live={fresh}
        volume={`Up ${fmt(up?.bestBid)}/${fmt(up?.bestAsk)} · Down ${fmt(down?.bestBid)}/${fmt(down?.bestAsk)}`}
        outcomes={[
          { id: "up", label: "Up", probability: upMid ?? 0, color: "hsl(var(--primary))" },
          { id: "down", label: "Down", probability: downMid ?? 0, color: "hsl(var(--destructive))" },
        ]}
        onOutcomeClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      />
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  idle: "idle", connecting: "connecting", live: "live", reconnecting: "reconnecting",
  stale: "delayed", closed: "closed", error: "error",
};

const PolymarketSidebar = ({ selectedCoin }: { selectedCoin: CoinId }) => {
  const { rows, status, isDiscovering } = usePolymarketCoinLive(selectedCoin);
  const coinInfo = COINS[selectedCoin];

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1.5 px-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: coinInfo.color }} />
        <span className="text-[11px] font-semibold text-foreground">{coinInfo.symbol} Markets</span>
        <span className={cn("ml-auto text-[9px] font-mono uppercase tracking-wide", status === "live" ? "text-primary" : "text-muted-foreground")}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
      {isDiscovering && rows.every((r) => !r.market) ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="@container flex flex-col gap-2 flex-1">
          {rows.map((row) => (
            <MarketCard key={row.timeframe} row={row} symbol={coinInfo.symbol} />
          ))}
        </div>
      )}
      <p className="text-[9px] text-muted-foreground px-1 pt-1 border-t border-border/20">
        Live CLOB book · bid/ask in $0–$1 · Click an outcome to open on Polymarket
      </p>
    </div>
  );
};

export default PolymarketSidebar;
