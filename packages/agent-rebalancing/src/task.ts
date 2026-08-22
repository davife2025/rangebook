import { checkRange, computeRecenteredRange, readPosition } from "./monitor";
import { rebalance } from "./rebalance";

export interface RebalanceJobInput {
  positionTokenId: bigint;
  positionManagerAddress: `0x${string}`;
  rangeWidthTicks: number;
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  env?: "mainnet" | "testnet";
}

export interface RebalanceJobDeliverable {
  summary: string;
  statusBefore: string;
  actionTaken: "rebalanced" | "none";
  txHash: `0x${string}` | null;
  checkedAt: string;
}

/**
 * The ERC-8183 job this agent fulfills: "Rebalance this LP position if
 * it's out of range." Now reads the real position itself (readPosition is
 * real as of this session) rather than taking pre-resolved state — same
 * pattern as fulfillAuditJob owning its own health-factor read.
 */
export async function fulfillRebalanceJob(input: RebalanceJobInput): Promise<RebalanceJobDeliverable> {
  const positionState = await readPosition(input.positionTokenId, input.positionManagerAddress, input.env ?? "testnet");
  const status = checkRange(positionState);
  const checkedAt = new Date().toISOString();

  if (status === "in_range") {
    return { summary: "Position is in range. No action needed.", statusBefore: status, actionTaken: "none", txHash: null, checkedAt };
  }

  const newRange = computeRecenteredRange(positionState.currentTick, input.rangeWidthTicks);

  const { txHash } = await rebalance({
    sessionKeyAddress: input.sessionKeyAddress,
    sessionSigner: input.sessionSigner,
    positionManagerAddress: input.positionManagerAddress,
    currentRange: positionState,
    newWidth: input.rangeWidthTicks,
  });

  return {
    summary: `Position was ${status}. Recentered to [${newRange.tickLower}, ${newRange.tickUpper}].`,
    statusBefore: status,
    actionTaken: "rebalanced",
    txHash,
    checkedAt,
  };
}
