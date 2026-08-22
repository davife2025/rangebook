import { encodeAbiParameters, encodePacked } from "viem";
import type { PoolKey, RangeState } from "./monitor";

export interface RebalanceParams {
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  positionManagerAddress: `0x${string}`;
  positionTokenId: bigint;
  poolKey: PoolKey;
  currentRange: RangeState;
  newWidth: number;
  recipient: `0x${string}`; // the wallet — receives the new position
}

// Confirmed directly against pancakeswap/infinity-periphery's own
// Actions.sol on GitHub this session.
const CL_DECREASE_LIQUIDITY = 0x01;
const CL_MINT_POSITION = 0x02;

const positionManagerAbi = [
  {
    type: "function",
    name: "modifyLiquidities",
    stateMutability: "payable",
    inputs: [
      { name: "payload", type: "bytes" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

/**
 * Confirmed this session against PancakeSwap's own docs and
 * infinity-periphery source: modifyLiquidities takes a payload built by
 * abi.encode(actions, params) — a packed one-byte-per-action string plus
 * a parallel bytes[] array, same shape as Universal Router's
 * commands/inputs. CL_MINT_POSITION's full 8-field encoding is directly
 * sourced from PancakeSwap's "Manage liquidity" guide and is real below.
 *
 * NOT a full implementation, and it would be dishonest to present it as
 * one — this is a substantially better-informed stub, not a finished
 * function. Three specific things are still genuinely open, not vaguely
 * gestured at:
 *
 * 1. CL_DECREASE_LIQUIDITY's exact param tuple wasn't directly confirmed
 *    — the docs page that lists it didn't extract cleanly from search.
 *    buildDecreaseLiquidityAction below is a reasonable inference from
 *    the mint action's shape, not a sourced fact.
 * 2. How the tokens freed by decreasing the old position flow into
 *    minting the new one, within one atomic payload, isn't confirmed —
 *    Grid Trading's swap solved an analogous problem by having one
 *    action deposit into the router and the next spend the router's
 *    resulting balance; whether CL positions compose the same way here
 *    is assumed, not verified.
 * 3. Settlement — PancakeSwap's guide mentions CLOSE_CURRENCY actions via
 *    a `finalizeModifyLiquidityWithClose` helper, but that helper's exact
 *    byte value and encoding weren't confirmed either.
 *
 * Building against these three specifically (in that order) is real,
 * scoped work — not starting over.
 */
export async function rebalance(_params: RebalanceParams): Promise<{ txHash: `0x${string}` }> {
  throw new Error(
    "rebalance() is a better-informed stub, not a working implementation — see the three numbered " +
      "gaps in the comment above buildMintPositionAction and this function.",
  );
}

/** CONFIRMED — PancakeSwap's own documented 8-field CL_MINT_POSITION encoding. */
export function buildMintPositionAction(params: {
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  amount0Max: bigint;
  amount1Max: bigint;
  recipient: `0x${string}`;
  hookData: `0x${string}`;
}): `0x${string}` {
  return encodeAbiParameters(
    [
      {
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
      { type: "int24" },
      { type: "int24" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "address" },
      { type: "bytes" },
    ],
    [
      params.poolKey,
      params.tickLower,
      params.tickUpper,
      params.liquidity,
      params.amount0Max,
      params.amount1Max,
      params.recipient,
      params.hookData,
    ],
  );
}

/**
 * INFERRED, NOT SOURCED — see gap 1 in the comment on rebalance() above.
 * Modeled on CL_MINT_POSITION's shape (a position action needs to at
 * least identify the position and bound the amounts), but this specific
 * field list has not been read directly from PancakeSwap's source. If a
 * decrease call reverts on a decode-length mismatch, this is the first
 * place to check against infinity-periphery's actual CLPositionManager.sol.
 */
export function buildDecreaseLiquidityAction(params: {
  tokenId: bigint;
  liquidity: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  hookData: `0x${string}`;
}): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes" }],
    [params.tokenId, params.liquidity, params.amount0Min, params.amount1Min, params.hookData],
  );
}

/** The action-byte packing — confirmed real regardless of how the open params questions resolve. */
export function packActions(actions: number[]): `0x${string}` {
  return encodePacked(
    actions.map(() => "uint8"),
    actions,
  );
}
