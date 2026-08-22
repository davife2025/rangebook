import { healthFactorAbi, clientFor } from "@rangebook/chain";

export type RiskLevel = "safe" | "warning" | "danger";

export interface HealthCheckResult {
  protocol: "aave-v3";
  healthFactor: number;
  riskLevel: RiskLevel;
  checkedAt: Date;
}

function riskLevelFor(healthFactor: number): RiskLevel {
  if (healthFactor >= 1.5) return "safe";
  if (healthFactor >= 1.15) return "warning";
  return "danger";
}

/**
 * Aave V3's Pool.getUserAccountData returns healthFactor directly (scaled
 * 1e18, where 1e18 == 1.0) — this is the easy case.
 */
export async function checkAaveHealthFactor(
  userAddress: `0x${string}`,
  env: "mainnet" | "testnet" = "testnet",
): Promise<HealthCheckResult> {
  const pool = requireEnv("AAVE_V3_POOL_ADDRESS");
  const client = clientFor(env);

  const data = await client.readContract({
    address: pool as `0x${string}`,
    abi: healthFactorAbi,
    functionName: "getUserAccountData",
    args: [userAddress],
  });

  const healthFactor = Number(data[5]) / 1e18;

  return {
    protocol: "aave-v3",
    healthFactor,
    riskLevel: riskLevelFor(healthFactor),
    checkedAt: new Date(),
  };
}

/**
 * NOT IMPLEMENTED. Venus is a Compound V2 fork — its Comptroller exposes
 * getAccountLiquidity(account) -> (error, liquidityUsd, shortfallUsd), not
 * a single healthFactor field. An Aave-style ratio has to be derived by
 * walking every market the user has entered (vToken balance x exchange
 * rate x collateral factor x oracle price, summed, divided by total borrow
 * value) — meaningfully more work than the Aave path above.
 *
 * Don't wire this into task.ts as if it works. It's here as the explicit
 * next thing to build, not a shortcut to take.
 */
export async function checkVenusAccountLiquidity(_userAddress: `0x${string}`): Promise<never> {
  throw new Error("Venus health-factor derivation not implemented yet — see comment above this function.");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — pull the current Aave V3 Pool address for BSC from the Aave V3 Lending ` +
        `skill file at skills.altana.network before checking a real position.`,
    );
  }
  return value;
}
