import { checkAaveHealthFactor } from "./monitor";
import { repayToDefend } from "./defend";

export interface AuditJobInput {
  targetWallet: `0x${string}`;
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  aavePoolAddress: `0x${string}`;
  debtAsset: `0x${string}`;
  env?: "mainnet" | "testnet";
}

export interface AuditJobDeliverable {
  summary: string;
  healthFactorBefore: number;
  healthFactorAfter: number | null;
  riskLevel: string;
  actionTaken: "repaid" | "none";
  txHash: `0x${string}` | null;
  checkedAt: string;
}

// A conservative fixed repay step, not a computed optimum. Sizing the exact
// minimal repay needed (walking oracle prices per asset) is real work not
// done here yet — see the note on fulfillAuditJob below.
const REPAY_STEP = process.env.HEALTH_FACTOR_REPAY_STEP
  ? BigInt(process.env.HEALTH_FACTOR_REPAY_STEP)
  : 50_000000000000000000n; // 50 tokens at 18 decimals

/**
 * The ERC-8183 job this agent fulfills — Altana's own documented example
 * task is "audit wallet 0x…'s Venus position and recommend an action";
 * this is that task for Aave V3, almost verbatim. TermiX or any other
 * agent hiring this one gets exactly this: check, defend if needed, report
 * with a real tx hash.
 *
 * The repay amount is a bounded fixed step rather than a computed optimum
 * on purpose — solving for the precise minimal repay means walking price
 * oracles per asset, which isn't built yet. This takes the safer, simpler
 * default of "repay a bounded step, then re-check" instead of pretending
 * to have that math done.
 */
export async function fulfillAuditJob(input: AuditJobInput): Promise<AuditJobDeliverable> {
  const env = input.env ?? "testnet";
  const before = await checkAaveHealthFactor(input.targetWallet, env);

  if (before.riskLevel !== "danger") {
    return {
      summary: `Health factor ${before.healthFactor.toFixed(2)} — ${before.riskLevel}. No action needed.`,
      healthFactorBefore: before.healthFactor,
      healthFactorAfter: before.healthFactor,
      riskLevel: before.riskLevel,
      actionTaken: "none",
      txHash: null,
      checkedAt: before.checkedAt.toISOString(),
    };
  }

  const { txHash } = await repayToDefend({
    sessionKeyAddress: input.sessionKeyAddress,
    sessionSigner: input.sessionSigner,
    aavePoolAddress: input.aavePoolAddress,
    debtAsset: input.debtAsset,
    repayAmount: REPAY_STEP,
    onBehalfOf: input.targetWallet,
  });

  const after = await checkAaveHealthFactor(input.targetWallet, env);

  return {
    summary:
      `Health factor was ${before.healthFactor.toFixed(2)} (danger). Repaid debt via session ` +
      `${input.sessionKeyAddress}; now ${after.healthFactor.toFixed(2)}.`,
    healthFactorBefore: before.healthFactor,
    healthFactorAfter: after.healthFactor,
    riskLevel: after.riskLevel,
    actionTaken: "repaid",
    txHash,
    checkedAt: after.checkedAt.toISOString(),
  };
}
