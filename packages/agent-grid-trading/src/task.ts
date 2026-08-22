import { findTriggeredLevels, computeAmountOutMin, type GridConfig } from "./grid";
import { executeLevel } from "./execute";

export interface GridJobInput {
  config: GridConfig;
  currentPrice: number;
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown;
  walletAddress: `0x${string}`;
  universalRouterAddress: `0x${string}`;
  amountPerLevel: bigint;
  baseDecimals: number;
  quoteDecimals: number;
  slippageBps?: number;
}

export interface GridJobDeliverable {
  summary: string;
  triggeredCount: number;
  txHashes: `0x${string}`[];
  checkedAt: string;
}

/**
 * The ERC-8183 job this agent fulfills: "Check and run this grid." Real
 * end to end as of this session — findTriggeredLevels decides what
 * triggered, computeAmountOutMin sizes the slippage guard, executeLevel
 * encodes and sends the actual swap through the session.
 */
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

  const slippageBps = input.slippageBps ?? 50;
  const txHashes: `0x${string}`[] = [];

  for (const level of triggered) {
    const buying = level.side === "buy";
    const tokenIn = buying ? input.config.pair.quote : input.config.pair.base;
    const tokenOut = buying ? input.config.pair.base : input.config.pair.quote;
    const decimalsIn = buying ? input.quoteDecimals : input.baseDecimals;
    const decimalsOut = buying ? input.baseDecimals : input.quoteDecimals;

    const amountOutMin = computeAmountOutMin({
      amountIn: input.amountPerLevel,
      price: level.price,
      side: level.side,
      decimalsIn,
      decimalsOut,
      slippageBps,
    });

    const { txHash } = await executeLevel({
      sessionKeyAddress: input.sessionKeyAddress,
      sessionSigner: input.sessionSigner,
      walletAddress: input.walletAddress,
      universalRouterAddress: input.universalRouterAddress,
      tokenIn,
      path: [tokenIn, tokenOut],
      amountIn: input.amountPerLevel,
      amountOutMin,
      level,
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
