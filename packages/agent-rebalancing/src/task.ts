import { checkRange, computeRecenteredRange, type RangeState } from "./monitor";
import { rebalance } from "./rebalance";

export interface RebalanceJobInput {
  positionState: RangeState; // supplied by caller until monitor.ts's readPosition is wired to a real call
  rangeWidthTicks: number;
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  positionManagerAddress: `0x${string}`;
}

export interface RebalanceJobDeliverable {
  summary: string;
  statusBefore: string;
  actionTaken: "rebalanced" | "none";
  txHash: `0x${string}` | null;
  checkedAt: string;
}

/** The ERC-8183 job this agent fulfills: "Rebalance this LP position if it's out of range." */
export async function fulfillRebalanceJob(input: RebalanceJobInput): Promise<RebalanceJobDeliverable> {
  const status = checkRange(input.positionState);
  const checkedAt = new Date().toISOString();

  if (status === "in_range") {
    return { summary: "Position is in range. No action needed.", statusBefore: status, actionTaken: "none", txHash: null, checkedAt };
  }

  const newRange = computeRecenteredRange(input.positionState.currentTick, input.rangeWidthTicks);

  const { txHash } = await rebalance({
    sessionKeyAddress: input.sessionKeyAddress,
    sessionSigner: input.sessionSigner,
    positionManagerAddress: input.positionManagerAddress,
    currentRange: input.positionState,
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
