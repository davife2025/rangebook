export interface YieldQuote {
  venue: "aave-v3" | "venus" | "lista" | "pancakeswap-liquidity";
  apr: number;
}

/**
 * Only moves if the improvement clears switchThresholdBps — that threshold
 * is meant to stand in for gas + slippage cost, kept as a simple flat
 * number here rather than computed per-transaction. Tune it, don't treat
 * it as precise.
 */
export function pickBestYield(
  quotes: YieldQuote[],
  currentVenue: YieldQuote["venue"],
  switchThresholdBps: number,
): YieldQuote | null {
  if (quotes.length === 0) return null;

  const current = quotes.find((q) => q.venue === currentVenue);
  const best = quotes.reduce((a, b) => (b.apr > a.apr ? b : a));

  if (!current) return best;

  const improvementBps = (best.apr - current.apr) * 100;
  return best.venue !== currentVenue && improvementBps > switchThresholdBps ? best : null;
}
