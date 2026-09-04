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
 * Real as of session 9, with one confirmed piece and one reasonably
 * confident piece kept distinct rather than presented as equally certain.
 * A third thing flagged as unsolved when this was written has since been
 * resolved elsewhere — Permit2 approval now happens in ActivateForm.tsx
 * during activation, not here.
 *
 * CONFIRMED this session: the command bytes (V2_SWAP_EXACT_IN,
 * PERMIT2_TRANSFER_FROM) against PancakeSwap's own Commands.sol, and
 * PERMIT2_TRANSFER_FROM's input shape — (address token, address
 * recipient, uint160 amount) — against Uniswap's current Dispatcher.sol.
 *
 * REASONABLY CONFIDENT, not independently verified against PancakeSwap's
 * own source: V2_SWAP_EXACT_IN's input struct below (recipient, amountIn,
 * amountOutMin, path, payerIsUser, minHopPriceX36) matches Uniswap's
 * current main-branch V2SwapRouter.sol — but that's Uniswap's repo, not
 * PancakeSwap's fork directly, and forks can lag the field list they
 * forked from. A decode-length revert here is the first thing to check
 * against PancakeSwap's own V2SwapRouter.sol.
 */
export async function executeLevel(params: ExecuteLevelParams): Promise<{ txHash: `0x${string}` }> {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + (params.deadlineSeconds ?? 300));

  const commands = encodePacked(["uint8", "uint8"], [PERMIT2_TRANSFER_FROM, V2_SWAP_EXACT_IN]);

  const permit2TransferInput = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint160" }],
    [params.tokenIn, params.universalRouterAddress, params.amountIn],
  );

  const v2SwapInput = encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "address[]" },
      { type: "bool" },
      { type: "uint256[]" },
    ],
    [params.walletAddress, params.amountIn, params.amountOutMin, params.path, false, []],
  );

  const executeCalldata = encodeFunctionData({
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commands, [permit2TransferInput, v2SwapInput], deadline],
  });

  return executeViaSession({
    walletAddress: params.walletAddress,
    sessionSigner: params.sessionSigner,
    calls: [{ to: params.universalRouterAddress, data: executeCalldata }],
  });
}
