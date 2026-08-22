import type { RangeState } from "./monitor";

export interface RebalanceParams {
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  positionManagerAddress: `0x${string}`;
  currentRange: RangeState;
  newWidth: number;
}

/**
 * NOT IMPLEMENTED — narrower than it used to be. Reading a position
 * (monitor.ts) is real as of this session. Writing one still isn't: the
 * actual move goes through CLPositionManager.modifyLiquidities, whose
 * payload is built via a Solidity-side "Planner" helper encoding actions
 * like CL_DECREASE_LIQUIDITY / CL_MINT_POSITION (see "Manage liquidity for
 * CL and Bin pool" at developer.pancakeswap.finance) — an action-encoding
 * scheme, not a plain function call, and not one this file reimplements
 * from a Solidity code sample.
 *
 * What's real: *what* the new range should be is decided correctly by
 * computeRecenteredRange in monitor.ts, and whatever calls eventually get
 * built here are meant to go through executeViaSession from
 * @rangebook/altana — same session, same spend cap, same allowlist
 * enforcement as every other agent's action.
 */
export async function rebalance(_params: RebalanceParams): Promise<{ txHash: `0x${string}` }> {
  throw new Error(
    "rebalance() not implemented — encode the modifyLiquidities action payload per PancakeSwap's " +
      "CL liquidity guide, then route it through executeViaSession. See the comment above.",
  );
}
