

## Plan: Real-Time Polymarket Up/Down Markets per Selected Coin

### What changes

When a user clicks a coin (BTC, ETH, SOL, XRP) in the price cards at the top, the bottom of the dashboard shows that coin's **live Polymarket Up/Down markets** for 5min, 15min, and 1hr side by side. Each market column is clickable and opens the Polymarket event page in a new tab.

### Problem with current approach

The current `usePolymarketPredictions.ts` fetches via `tag_id=100381` and tries to detect coins/timeframes from question text. This is fragile and often returns no results. The READMEs describe a **deterministic epoch-based slug pattern** that reliably finds active markets.

### Technical approach

#### 1. Rewrite `usePolymarketPredictions.ts` -- Deterministic slug discovery

- Use the epoch-based slug pattern: `{asset}-updown-{tf}-{floor(epoch/interval)*interval}`
- For 5m (300s), 15m (900s), 1hr: 5m and 15m use epoch slugs; 1hr uses title search (`"bitcoin up or down"` etc.)
- For each coin+timeframe, generate the current window slug + previous window slug (fallback during resolution)
- Fetch via `https://gamma-api.polymarket.com/events/slug/{slug}` for epoch-based
- Fetch via `https://gamma-api.polymarket.com/events?title={query}&active=true` for 1hr
- Extract from each event: `outcomePrices` (Up/Down), slug (for URL), `clobTokenIds`, question, end date, price to beat
- **CORS issue**: Gamma API may block direct browser calls. If so, we need an edge function proxy. Since there's no Supabase setup yet, we'll try direct fetch first (the current code already does this successfully for tag_id queries), and include the proxy as a fallback plan.
- Refetch every 30 seconds, staleTime 15s

#### 2. New component: `CoinMarketStrip.tsx`

A horizontal strip that shows 3 columns (5min | 15min | 1hr) for the currently selected coin. Each column displays:
- **Clickable header**: timeframe label (e.g., "5 Min") -- clicks open `https://polymarket.com/event/{slug}` in new tab
- **Price to Beat**: the strike price
- **Up price** (green) with $1 payout calculation
- **Down price** (red) with $1 payout calculation
- **Distance gauge**: % away from current spot price
- LIVE pulse indicator

This replaces (or supplements) the existing `PolymarketGrid` which is a separate comparison tool. The strip is driven by `selectedCoin` from Dashboard state.

#### 3. Update `Dashboard.tsx`

- Pass `selectedCoin` to the new `CoinMarketStrip` component, placed between the chart section and the PolymarketGrid
- The strip reactively updates when the user clicks a different coin in the price cards
- Remove the BTC-only `SentimentTable` (its functionality is now covered by the per-coin strip)

#### 4. Update `PolymarketGrid.tsx`

- Update to use the new deterministic data source
- Make each market card header clickable (opens Polymarket event URL in new tab)

### Files to create/edit

| File | Action |
|------|--------|
| `src/hooks/usePolymarketPredictions.ts` | Rewrite with deterministic slug discovery |
| `src/components/dashboard/CoinMarketStrip.tsx` | New -- per-coin 3-column timeframe strip |
| `src/components/dashboard/PolymarketGrid.tsx` | Update data source, add clickable links |
| `src/pages/Dashboard.tsx` | Add CoinMarketStrip, remove SentimentTable |

