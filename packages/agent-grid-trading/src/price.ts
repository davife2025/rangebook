import { clientFor } from "@rangebook/chain";

/**
 * Grid Trading's currentPrice was always an external input with nowhere
 * real supplying it. This closes that — not with Token Radar (see the
 * note in skills.ts: that skill screens tokens for risk, it doesn't feed
 * live prices, a wrong assumption sitting in this project since session
 * 1), but by reusing the exact getSlot0 read already confirmed for
 * Rebalancing in session 6. Same pool manager, same call, same
 * confidence level — not new unverified ground.
 */

const clPoolManagerAbi = [
  {
    type: "function",
    name: "getSlot0",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "protocolFee", type: "uint24" },
      { name: "lpFee", type: "uint24" },
    ],
  },
] as const;

/**
 * Converts sqrtPriceX96 (Q64.96 fixed point) to a plain price ratio.
 * Standard Uniswap-v3-family math, not protocol-specific to Infinity —
 * this formula is stable across every fork that uses this price
 * representation, high confidence independent of anything Altana- or
 * PancakeSwap-specific.
 */
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimalsToken0: number, decimalsToken1: number): number {
  const Q96 = 2 ** 96;
  const ratio = Number(sqrtPriceX96) / Q96;
  const rawPrice = ratio * ratio;
  return rawPrice * 10 ** (decimalsToken0 - decimalsToken1);
}

/**
 * Reads a grid's current reference price directly from the pool —
 * requires the poolId (same computePoolId as monitor.ts's rebalancing
 * read; if the pair's pool isn't an Infinity CL pool, this won't
 * resolve, and that's a real constraint worth knowing rather than a bug
 * to chase).
 */
export async function getCurrentGridPrice(
  poolManagerAddress: `0x${string}`,
  poolId: `0x${string}`,
  baseDecimals: number,
  quoteDecimals: number,
  env: "mainnet" | "testnet" = "testnet",
): Promise<number> {
  const client = clientFor(env);
  const [sqrtPriceX96] = await client.readContract({
    address: poolManagerAddress,
    abi: clPoolManagerAbi,
    functionName: "getSlot0",
    args: [poolId],
  });
  return sqrtPriceX96ToPrice(sqrtPriceX96, baseDecimals, quoteDecimals);
}
