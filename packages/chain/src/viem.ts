import { createPublicClient, http, type PublicClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";

/**
 * Live protocol reads only — health factors, LP in-range status, current
 * supply APRs. This is the "beyond basic counts" half of the marketplace's
 * data quality; the other half is @rangebook/chain's 8004scan client.
 */
export function bscMainnetClient(): PublicClient {
  return createPublicClient({
    chain: bsc,
    transport: http(process.env.BSC_MAINNET_RPC ?? bsc.rpcUrls.default.http[0]),
  });
}

export function bscTestnetClient(): PublicClient {
  return createPublicClient({
    chain: bscTestnet,
    transport: http(process.env.BSC_TESTNET_RPC ?? bscTestnet.rpcUrls.default.http[0]),
  });
}

export function clientFor(env: "mainnet" | "testnet"): PublicClient {
  return env === "mainnet" ? bscMainnetClient() : bscTestnetClient();
}

// --- Minimal ABIs, read-only fragments only. Extend per-protocol as each
// agent is built; keep these narrow rather than importing a whole protocol's
// ABI for a couple of view calls.

export const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Aave V3 / Venus pools expose an equivalent getUserAccountData view; the
// exact address differs by protocol and is intentionally not hardcoded here.
// Pull it from the Altana skill file at build time (see @rangebook/altana),
// which is kept current against the live deployment.
export const healthFactorAbi = [
  {
    type: "function",
    name: "getUserAccountData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;
