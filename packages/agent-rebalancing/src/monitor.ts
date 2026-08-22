import { encodeAbiParameters, keccak256 } from "viem";
import { clientFor } from "@rangebook/chain";

export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  hooks: `0x${string}`;
  poolManager: `0x${string}`;
  fee: number;
  parameters: `0x${string}`;
}

// Confirmed against pancakeswap/infinity-periphery/src/pool-cl/CLPositionManager.sol
// on GitHub this session — positions(tokenId) returns the PoolKey plus the
// range directly, no separate lookup needed for those.
const clPositionManagerAbi = [
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "hooks", type: "address" },
          { name: "poolManager", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "parameters", type: "bytes32" },
        ],
      },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "subscriber", type: "address" },
    ],
  },
] as const;

// Confirmed against the deployed CLPoolManager's verified ABI on BscScan
// (0x32C59D556B16DB81DFc32525eFb3CB257f7e493d) this session — getSlot0
// really is a real, callable function on the live contract, first return
// value really is sqrtPriceX96. The second value being `tick` specifically
// (rather than something else) is inferred from the V3/V4 slot0 convention
// Infinity is explicitly modeled on, not read off the ABI itself — if this
// misdecodes, that ordering is the first thing to check.
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

export interface RangeState {
  currentTick: number;
  tickLower: number;
  tickUpper: number;
}

export interface PositionState extends RangeState {
  poolKey: PoolKey;
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
 * Real as of this session, not a guess — confirmed against Infinity's
 * actual source and a live deployed contract's verified ABI, not just the
 * general "it's V4-shaped" pattern this file assumed before. One piece is
 * still an inference rather than a sourced fact: PoolIdLibrary.toId()'s
 * exact hash. See computePoolId below for exactly what's assumed there.
 */
export async function readPosition(
  positionTokenId: bigint,
  positionManagerAddress: `0x${string}`,
  env: "mainnet" | "testnet" = "testnet",
): Promise<PositionState> {
  const client = clientFor(env);

  const [poolKey, tickLower, tickUpper] = await client.readContract({
    address: positionManagerAddress,
    abi: clPositionManagerAbi,
    functionName: "positions",
    args: [positionTokenId],
  });

  const poolId = computePoolId(poolKey);

  const [, currentTick] = await client.readContract({
    address: poolKey.poolManager,
    abi: clPoolManagerAbi,
    functionName: "getSlot0",
    args: [poolId],
  });

  return { currentTick, tickLower, tickUpper, poolKey };
}

/**
 * INFERRED, NOT SOURCED. Assumes Solidity's PoolIdLibrary.toId() is
 * keccak256 of the abi-encoded PoolKey struct — the standard Uniswap V4
 * pattern, and Infinity is explicitly documented as V4-shaped except where
 * it says otherwise, but I haven't seen PoolIdLibrary.sol's actual source.
 * If a position's poolId comes back wrong (getSlot0 reverts, or returns
 * data for the wrong pool), this function is where to check first —
 * everything upstream of it (positions(), getSlot0() themselves) is
 * confirmed against real sources this session.
 */
function computePoolId(poolKey: PoolKey): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "bytes32" },
      ],
      [poolKey.currency0, poolKey.currency1, poolKey.hooks, poolKey.poolManager, poolKey.fee, poolKey.parameters],
    ),
  );
}
