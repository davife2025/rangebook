import { checkRange, computeRecenteredRange, readPosition } from "./monitor";
import { rebalance } from "./rebalance";

export interface RebalanceJobInput {
  positionTokenId: bigint;
  positionManagerAddress: `0x${string}`;
  rangeWidthTicks: number;
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  walletAddress: `0x${string}`;
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
 * it's out of range." Reads the real position (readPosition is real as
 * of session 6). rebalance() itself is still a well-informed stub (see
 * its file) — this will throw past the "in range, no action" case until
 * that's finished.
 */
export async function fulfillRebalanceJob(input: RebalanceJobInput): Promise<RebalanceJobDeliverable> {
  const env = input.env ?? "testnet";
  const position = await readPosition(input.positionTokenId, input.positionManagerAddress, env);
  const status = checkRange(position);
  const checkedAt = new Date().toISOString();

  if (status === "in_range") {
    return { summary: "Position is in range. No action needed.", statusBefore: status, actionTaken: "none", txHash: null, checkedAt };
  }

  const newRange = computeRecenteredRange(position.currentTick, input.rangeWidthTicks);

  const { txHash } = await rebalance({
    sessionKeyAddress: input.sessionKeyAddress,
    sessionSigner: input.sessionSigner,
    positionManagerAddress: input.positionManagerAddress,
    positionTokenId: input.positionTokenId,
    poolKey: position.poolKey,
    currentRange: position,
    newWidth: input.rangeWidthTicks,
    recipient: input.walletAddress,
  });

  return {
    summary: `Position was ${status}. Recentered to [${newRange.tickLower}, ${newRange.tickUpper}].`,
    statusBefore: status,
    actionTaken: "rebalanced",
    txHash,
    checkedAt,
  };
}
