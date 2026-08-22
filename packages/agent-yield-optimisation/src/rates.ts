import { clientFor } from "@rangebook/chain";

// Aave V3's AaveProtocolDataProvider — a flatter, friendlier read surface
// than Pool.getReserveData's nested struct, so there's less to get wrong
// in the ABI. Still: verify the data provider address for the current BSC
// deployment before use, field order is decode-critical.
const aaveDataProviderAbi = [
  {
    type: "function",
    name: "getReserveData",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "unbacked", type: "uint256" },
      { name: "accruedToTreasuryScaled", type: "uint256" },
      { name: "totalAToken", type: "uint256" },
      { name: "totalStableDebt", type: "uint256" },
      { name: "totalVariableDebt", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "variableBorrowRate", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "averageStableBorrowRate", type: "uint256" },
      { name: "liquidityIndex", type: "uint256" },
      { name: "variableBorrowIndex", type: "uint256" },
      { name: "lastUpdateTimestamp", type: "uint40" },
    ],
  },
] as const;

/** Aave rates are "ray"-scaled (1e27). Returns an APR percentage, e.g. 8.2 for 8.2%. */
export async function getAaveSupplyApr(
  asset: `0x${string}`,
  env: "mainnet" | "testnet" = "testnet",
): Promise<number> {
  const dataProvider = requireEnv("AAVE_V3_DATA_PROVIDER_ADDRESS");
  const client = clientFor(env);
  const data = await client.readContract({
    address: dataProvider as `0x${string}`,
    abi: aaveDataProviderAbi,
    functionName: "getReserveData",
    args: [asset],
  });
  const liquidityRateRay = data[5];
  return (Number(liquidityRateRay) / 1e27) * 100;
}

// Venus is a Compound V2 fork — supplyRatePerBlock is a stable, simple,
// long-established interface. Lower risk than Aave's struct decode, higher
// risk on the assumption below: BSC's block time. Verify it hasn't moved
// before trusting this number.
const vTokenAbi = [
  {
    type: "function",
    name: "supplyRatePerBlock",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ASSUMED_BSC_BLOCK_TIME_SECONDS = 3; // verify against current BSC block time before trusting this APR

export async function getVenusSupplyApr(
  vTokenAddress: `0x${string}`,
  env: "mainnet" | "testnet" = "testnet",
): Promise<number> {
  const client = clientFor(env);
  const ratePerBlock = await client.readContract({
    address: vTokenAddress,
    abi: vTokenAbi,
    functionName: "supplyRatePerBlock",
  });
  const blocksPerYear = (365 * 24 * 60 * 60) / ASSUMED_BSC_BLOCK_TIME_SECONDS;
  return (Number(ratePerBlock) / 1e18) * blocksPerYear * 100;
}

/**
 * NOT IMPLEMENTED. Lista's liquid-staking APR isn't a single view call —
 * it's implied by the slisBNB/BNB exchange rate's change over time, which
 * means tracking it yourself over a window or pulling Lista's own
 * published figure from their API. Needs a data source this file
 * doesn't have.
 */
export async function getListaApr(): Promise<never> {
  throw new Error("Lista APR not implemented — needs exchange-rate tracking or Lista's API. See comment above.");
}

/**
 * NOT IMPLEMENTED. PancakeSwap's LP fee APR isn't on-chain in one call
 * either — it needs historical volume, which means their subgraph, not a
 * readContract call. Needs a data source this file doesn't have.
 */
export async function getPancakeSwapLpFeeApr(): Promise<never> {
  throw new Error("PancakeSwap LP fee APR not implemented — needs subgraph volume data. See comment above.");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}
