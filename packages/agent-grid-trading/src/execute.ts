import { encodeAbiParameters, encodeFunctionData, encodePacked } from "viem";
import { executeViaSession } from "@rangebook/altana";
import type { TriggeredLevel } from "./grid";

// Confirmed directly against pancakeswap/infinity-universal-router's own
// src/libraries/Commands.sol on GitHub this session — these are
// PancakeSwap's actual values, not assumed-identical-to-Uniswap.
const V2_SWAP_EXACT_IN = 0x08;
const PERMIT2_TRANSFER_FROM = 0x02;

const universalRouterAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export interface ExecuteLevelParams {
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  walletAddress: `0x${string}`; // receives the swap output — the session key itself holds nothing
  universalRouterAddress: `0x${string}`;
  tokenIn: `0x${string}`;
  path: `0x${string}`[]; // [tokenIn, tokenOut] — direct pair
  amountIn: bigint;
  amountOutMin: bigint;
  level: TriggeredLevel;
  deadlineSeconds?: number;
}

/**
 * Real as of this session, with one confirmed piece, one reasonably
 * confident piece, and one genuinely open gap — worth keeping those
 * separate rather than presenting them as equally certain:
 *
 * CONFIRMED this session: the command bytes (V2_SWAP_EXACT_IN,
 * PERMIT2_TRANSFER_FROM) against PancakeSwap's own Commands.sol, and
 * PERMIT2_TRANSFER_FROM's input shape — (address token, address
 * recipient, uint160 amount) — against Uniswap's current Dispatcher.sol.
 *
 * REASONABLY CONFIDENT, not independently verified against PancakeSwap's
 * own source: V2_SWAP_EXACT_IN's input struct below (recipient, amountIn,
 * amountOutMin, path, payerIsUser, minHopPriceX36) matches Uniswap's
 * current main-branch V2SwapRouter.sol, fetched fresh this session — but
 * that's Uniswap's repo, not PancakeSwap's fork directly, and forks can
 * lag the field list they forked from (older Uniswap versions had 5
 * fields, no minHopPriceX36). A decode-length revert here is the first
 * thing to check against PancakeSwap's own V2SwapRouter.sol.
 *
 * GENUINELY UNSOLVED: PERMIT2_TRANSFER_FROM only pulls tokens Permit2
 * already has an allowance for. That allowance is a one-time approve()
 * from the wallet to Permit2 — real, necessary setup this function
 * doesn't perform, and that isn't part of the Altana session grant
 * either. Needs to happen once, out of band, before this runs for real.
 */
export async function executeLevel(params: ExecuteLevelParams): Promise<{ txHash: `0x${string}` }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineSeconds ?? 300));

  const commands = encodePacked(["uint8", "uint8"], [PERMIT2_TRANSFER_FROM, V2_SWAP_EXACT_IN]);

  // Step 1: pull tokenIn from the wallet into the router itself, via
  // Permit2's pre-existing allowance.
  const permit2TransferInput = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint160" }],
    [params.tokenIn, params.universalRouterAddress, params.amountIn],
  );

  // Step 2: swap using the balance the router just received in step 1 —
  // payerIsUser is false because the payer for this step is the router
  // itself, not a fresh pull from the caller.
  const v2SwapInput = encodeAbiParameters(
    [
      { type: "address" }, // recipient
      { type: "uint256" }, // amountIn
      { type: "uint256" }, // amountOutMin
      { type: "address[]" }, // path
      { type: "bool" }, // payerIsUser
      { type: "uint256[]" }, // minHopPriceX36 — empty disables per-hop price limits
    ],
    [params.walletAddress, params.amountIn, params.amountOutMin, params.path, false, []],
  );

  const executeCalldata = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commands, [permit2TransferInput, v2SwapInput], deadline],
  });

  return executeViaSession({
    sessionKeyAddress: params.sessionKeyAddress,
    sessionSigner: params.sessionSigner,
    calls: [{ to: params.universalRouterAddress, data: executeCalldata }],
  });
}

