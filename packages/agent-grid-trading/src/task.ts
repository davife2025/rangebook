import { findTriggeredLevels, computeAmountOutMin, type GridConfig } from "./grid";
import { executeLevel } from "./execute";
import { getCurrentGridPrice } from "./price";

export interface GridJobInput {
  config: GridConfig;
  poolManagerAddress: `0x${string}`;
  poolId: `0x${string}`;
  sessionSigner: unknown;
  walletAddress: `0x${string}`;
  universalRouterAddress: `0x${string}`;
  amountPerLevel: bigint;
  baseDecimals: number;
  quoteDecimals: number;
  slippageBps?: number;
  env?: "mainnet" | "testnet";
}

export interface GridJobDeliverable {
  summary: string;
  currentPrice: number;
  triggeredCount: number;
  txHashes: `0x${string}`[];
  checkedAt: string;
}

/**
 * The ERC-8183 job this agent fulfills: "Check and run this grid." Now
 * reads its own price (price.ts, this session) instead of taking
 * currentPrice as an unsupplied external input — matching how
 * fulfillAuditJob and fulfillYieldJob own their own reads. That was the
 * actual gap; Token Radar was never the right tool for it (see the note
 * in skills.ts).
 */
export async function fulfillGridJob(input: GridJobInput): Promise<GridJobDeliverable> {
  const env = input.env ?? "testnet";
  const currentPrice = await getCurrentGridPrice(
    input.poolManagerAddress,
    input.poolId,
    input.baseDecimals,
    input.quoteDecimals,
    env,
  );

  const triggered = findTriggeredLevels(input.config, currentPrice);
  const checkedAt = new Date().toISOString();

  if (triggered.length === 0) {
    return {
      summary: `No levels triggered at price ${currentPrice}.`,
      currentPrice,
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
    summary: `${triggered.length} level(s) triggered at price ${currentPrice} — executed ${txHashes.length}.`,
    currentPrice,
    triggeredCount: triggered.length,
    txHashes,
    checkedAt,
  };
}
