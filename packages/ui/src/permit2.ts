"use client";

import type { WalletClient } from "viem";

// Permit2's canonical deterministic-deployment address — the same on most
// EVM chains including BSC. Worth a quick BscScan check before trusting
// this for a real transaction, but this isn't the kind of protocol-
// specific inference the Infinity/Universal Router encodings needed.
export const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA" as const;

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const permit2Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
] as const;

const MAX_UINT160 = 2n ** 160n - 1n;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * The two-step approval Grid Trading and Rebalancing both need before
 * their first real swap or position write: an ERC20 approve from the
 * wallet to Permit2 (effectively permanent), then a time-boxed
 * Permit2.approve granting the actual spender (Universal Router or
 * CLPositionManager) allowance through Permit2's own accounting.
 *
 * Always sends both transactions rather than checking existing allowance
 * first — simpler, and idempotent (re-approving is harmless), at the cost
 * of an occasional redundant transaction on repeat activations. A real
 * optimization, not a correctness gap.
 */
export async function ensurePermit2Approval(params: {
  walletClient: WalletClient;
  account: `0x${string}`;
  token: `0x${string}`;
  spender: `0x${string}`;
}): Promise<{ erc20ApproveTx: `0x${string}`; permit2ApproveTx: `0x${string}` }> {
  const erc20ApproveTx = await params.walletClient.writeContract({
    address: params.token,
    abi: erc20Abi,
    functionName: "approve",
    args: [PERMIT2_ADDRESS, 2n ** 256n - 1n],
    account: params.account,
    chain: params.walletClient.chain,
  });

  const expiration = Math.floor(Date.now() / 1000) + ONE_YEAR_SECONDS;
  const permit2ApproveTx = await params.walletClient.writeContract({
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: "approve",
    args: [params.token, params.spender, MAX_UINT160, expiration],
    account: params.account,
    chain: params.walletClient.chain,
  });

  return { erc20ApproveTx, permit2ApproveTx };
}
