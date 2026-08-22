import { executeViaSession } from "@rangebook/altana";
import type { YieldQuote } from "./compare";

export interface ReallocateParams {
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  from: { venue: YieldQuote["venue"]; contractAddress: `0x${string}`; withdrawCalldata: `0x${string}` };
  to: { venue: YieldQuote["venue"]; contractAddress: `0x${string}`; supplyCalldata: `0x${string}` };
}

/**
 * Takes pre-built calldata rather than constructing it here — the actual
 * withdraw/supply call differs per venue (Aave's withdraw/supply, Venus's
 * redeem/mint, Lista's unstake/stake, PancakeSwap's
 * decreaseLiquidity/increaseLiquidity), and encoding all four correctly is
 * more surface area than this session covers.
 *
 * What IS real and worth keeping: both calls go through the *same*
 * execute, in the *same* session — the withdrawal and the re-supply either
 * both land or neither does. Don't split this into two separate
 * executeViaSession calls; that reintroduces the failure mode where funds
 * sit idle between them if the second call fails.
 */
export async function reallocate(params: ReallocateParams): Promise<{ txHash: `0x${string}` }> {
  return executeViaSession({
    sessionKeyAddress: params.sessionKeyAddress,
    sessionSigner: params.sessionSigner,
    calls: [
      { to: params.from.contractAddress, data: params.from.withdrawCalldata },
      { to: params.to.contractAddress, data: params.to.supplyCalldata },
    ],
  });
}
