import { findTriggeredLevels, type GridConfig } from "./grid";
import { executeLevel } from "./execute";

export interface GridJobInput {
  config: GridConfig;
  currentPrice: number;
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  universalRouterAddress: `0x${string}`;
  amountPerLevel: bigint;
}

export interface GridJobDeliverable {
  summary: string;
  triggeredCount: number;
  txHashes: `0x${string}`[];
  checkedAt: string;
}

/** The ERC-8183 job this agent fulfills: "Check and run this grid." */
export async function fulfillGridJob(input: GridJobInput): Promise<GridJobDeliverable> {
  const triggered = findTriggeredLevels(input.config, input.currentPrice);
  const checkedAt = new Date().toISOString();

  if (triggered.length === 0) {
    return {
      summary: `No levels triggered at price ${input.currentPrice}.`,
      triggeredCount: 0,
      txHashes: [],
      checkedAt,
    };
  }

  const txHashes: `0x${string}`[] = [];
  for (const level of triggered) {
    const { txHash } = await executeLevel({
      sessionKeyAddress: input.sessionKeyAddress,
      sessionSigner: input.sessionSigner,
      universalRouterAddress: input.universalRouterAddress,
      level,
      amount: input.amountPerLevel,
      slippageBps: 50,
    });
    txHashes.push(txHash);
  }

  return {
    summary: `${triggered.length} level(s) triggered at price ${input.currentPrice} — executed ${txHashes.length}.`,
    triggeredCount: triggered.length,
    txHashes,
    checkedAt,
  };
}
