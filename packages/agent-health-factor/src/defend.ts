import { encodeFunctionData } from "viem";
import { executeViaSession } from "@rangebook/altana";

const aaveRepayAbi = [
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" }, // 2 = variable; stable is deprecated on current Aave V3 deployments
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface DefendPositionParams {
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  aavePoolAddress: `0x${string}`;
  debtAsset: `0x${string}`;
  repayAmount: bigint; // caller decides how much — this file enforces nothing about sizing
  onBehalfOf: `0x${string}`; // the wallet whose position is being defended
}

/**
 * Repays debt to pull a position's health factor back up. The spend cap on
 * the session is the actual backstop against an over-large repay — this
 * function doesn't duplicate that check, it relies on it: an amount outside
 * the session's spend limit reverts at validation, same as an out-of-
 * allowlist contract would.
 *
 * Adding collateral (Aave's `supply`) is the same call shape against a
 * different selector — not built here since repay covers the common case
 * (reduce debt) and this file is meant to stay narrow.
 */
export async function repayToDefend(params: DefendPositionParams): Promise<{ txHash: `0x${string}` }> {
  const data = encodeFunctionData({
    abi: aaveRepayAbi,
    functionName: "repay",
    args: [params.debtAsset, params.repayAmount, 2n, params.onBehalfOf],
  });

  return executeViaSession({
    sessionKeyAddress: params.sessionKeyAddress,
    sessionSigner: params.sessionSigner,
    calls: [{ to: params.aavePoolAddress, data }],
  });
}
