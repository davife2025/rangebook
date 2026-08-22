import type { TriggeredLevel } from "./grid";

export interface ExecuteLevelParams {
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  universalRouterAddress: `0x${string}`;
  level: TriggeredLevel;
  amount: bigint;
  slippageBps: number;
}

/**
 * NOT IMPLEMENTED. PancakeSwap swaps now route through Universal Router —
 * execute(bytes commands, bytes[] inputs, uint256 deadline) — a
 * command-encoded call, not a plain swapExactTokensForTokens selector.
 * Encoding that correctly, with a real slippage guard, is genuine work
 * this file isn't faking. The Altana PancakeSwap Trading skill has already
 * done this encoding and is fork-tested against the live chain — build
 * against that rather than hand-rolling Universal Router commands here.
 *
 * findTriggeredLevels in grid.ts is correct today and doesn't depend on
 * this. Whatever swap call eventually lands here routes through
 * executeViaSession from @rangebook/altana, same as every other agent.
 */
export async function executeLevel(_params: ExecuteLevelParams): Promise<{ txHash: `0x${string}` }> {
  throw new Error(
    "executeLevel not implemented — build the swap via the Altana PancakeSwap Trading skill. " +
      "See the comment above.",
  );
}
