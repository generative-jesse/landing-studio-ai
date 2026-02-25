import { usePolymarketPredictions } from '@/hooks/usePolymarketPredictions';
import { formatPrice } from '@/lib/crypto-api';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TrendingUp, Loader2 } from 'lucide-react';

const SentimentTable = () => {
  const { data: predictions, isLoading, isError } = usePolymarketPredictions();

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/10 p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Polymarket Sentiment</h3>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
          LIVE
        </Badge>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          Unable to fetch prediction markets.
        </p>
      )}

      {predictions && predictions.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-[11px] h-8 px-2">Timeframe</TableHead>
              <TableHead className="text-[11px] h-8 px-2">Target Price</TableHead>
              <TableHead className="text-[11px] h-8 px-2 text-right">Probability (UP)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {predictions.map((p) => (
              <TableRow key={p.conditionId} className="border-border/20 hover:bg-secondary/30">
                <TableCell className="text-xs px-2 py-2 font-medium">{p.timeframe}</TableCell>
                <TableCell className="text-xs px-2 py-2 font-mono">{formatPrice(p.targetPrice)}</TableCell>
                <TableCell className="text-right px-2 py-2">
                  <Badge
                    className={`text-[10px] px-1.5 py-0 ${
                      p.yesProb >= 60
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : p.yesProb >= 40
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-destructive/20 text-destructive border-destructive/30'
                    }`}
                    variant="outline"
                  >
                    {p.yesProb}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {predictions && predictions.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No active BTC prediction markets found.
        </p>
      )}
    </div>
  );
};

export default SentimentTable;
