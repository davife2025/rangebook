export interface RangeState {
  currentTick: number;
  tickLower: number;
  tickUpper: number;
}

export type RangeStatus = "in_range" | "out_of_range_below" | "out_of_range_above";

/** Protocol-agnostic — correct regardless of which exact call produced RangeState. */
export function checkRange(state: RangeState): RangeStatus {
  if (state.currentTick < state.tickLower) return "out_of_range_below";
  if (state.currentTick > state.tickUpper) return "out_of_range_above";
  return "in_range";
}

/** Recenters a range of the same width on the current tick. */
export function computeRecenteredRange(
  currentTick: number,
  widthTicks: number,
): { tickLower: number; tickUpper: number } {
  const half = Math.floor(widthTicks / 2);
  return { tickLower: currentTick - half, tickUpper: currentTick + half };
}

/**
 * NOT IMPLEMENTED. PancakeSwap Infinity's CLAMM reads through a singleton
 * CLPositionManager (see pancakeswap/infinity-periphery on GitHub,
 * src/pool-cl/CLPositionManager.sol), identified by PoolKey rather than a
 * simple pool address — a genuinely different shape from the classic V3
 * NonfungiblePositionManager.positions(tokenId) pattern this file would
 * otherwise be tempted to copy. Rather than guess Infinity's exact read
 * signature, pull it from that source, or from the Altana PancakeSwap
 * Liquidity skill (fork-tested against the live chain), before wiring this
 * up. checkRange and computeRecenteredRange above are correct today
 * regardless of which call fills in RangeState — that's the part worth
 * trusting from this file right now.
 */
export async function readPosition(_positionId: bigint): Promise<RangeState> {
  throw new Error(
    "readPosition not implemented — pull the CLPositionManager read call from " +
      "pancakeswap/infinity-periphery before wiring this up. See the comment above.",
  );
}
