import type { RangeState } from "./monitor";

export interface RebalanceParams {
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  positionManagerAddress: `0x${string}`;
  currentRange: RangeState;
  newWidth: number;
}

/**
 * NOT IMPLEMENTED. The real move — remove liquidity from the old range,
 * re-add at the new one — goes through CLPositionManager.modifyLiquidities
 * with Permit2-signed calls (see "Manage liquidity for CL and Bin pool" at
 * developer.pancakeswap.finance). That's a multi-step encoded call this
 * file isn't faking a version of.
 *
 * What's real: *what* the new range should be is already decided correctly
 * by computeRecenteredRange in monitor.ts, and whatever calls eventually
 * get built here are meant to go through executeViaSession from
 * @rangebook/altana — same session, same spend cap, same allowlist
 * enforcement as every other agent's action. Don't build a parallel
 * execution path for this one.
 */
export async function rebalance(_params: RebalanceParams): Promise<{ txHash: `0x${string}` }> {
  throw new Error(
    "rebalance() not implemented — build the modifyLiquidities call per PancakeSwap's " +
      "CL liquidity guide, then route it through executeViaSession. See the comment above.",
  );
}
