import { getAaveSupplyApr, getVenusSupplyApr } from "./rates";
import { pickBestYield, type YieldQuote } from "./compare";

export interface YieldJobInput {
  currentVenue: YieldQuote["venue"];
  aaveAsset: `0x${string}`;
  venusVToken: `0x${string}`;
  switchThresholdBps: number;
  env?: "mainnet" | "testnet";
}

export interface YieldJobDeliverable {
  summary: string;
  quotes: YieldQuote[];
  actionTaken: "reallocated" | "none";
  checkedAt: string;
}

/**
 * The ERC-8183 job this agent fulfills: "Find and move to the best real
 * yield." Only Aave and Venus are quoted for real here — see rates.ts for
 * why Lista and PancakeSwap aren't wired in yet. This compares two of the
 * four venues correctly rather than pretending to compare all four; the
 * shape (quotes array, pickBestYield) is ready to take the other two once
 * their rate sources exist, without needing to change the decision logic.
 *
 * Reallocation itself isn't triggered automatically here even when a
 * better venue is found — reallocate.ts needs real per-venue calldata
 * that isn't built yet (see its comment). This reports the finding rather
 * than acting on a call it can't yet construct correctly.
 */
export async function fulfillYieldJob(input: YieldJobInput): Promise<YieldJobDeliverable> {
  const env = input.env ?? "testnet";
  const [aaveApr, venusApr] = await Promise.all([
    getAaveSupplyApr(input.aaveAsset, env),
    getVenusSupplyApr(input.venusVToken, env),
  ]);

  const quotes: YieldQuote[] = [
    { venue: "aave-v3", apr: aaveApr },
    { venue: "venus", apr: venusApr },
  ];

  const checkedAt = new Date().toISOString();
  const best = pickBestYield(quotes, input.currentVenue, input.switchThresholdBps);

  const summary = best
    ? `Better yield found at ${best.venue} (${best.apr.toFixed(2)}%) vs current ${input.currentVenue}. ` +
      `Reallocation calldata isn't wired yet — reporting only.`
    : `Checked ${quotes.map((q) => `${q.venue} ${q.apr.toFixed(2)}%`).join(", ")}. Current venue is still best.`;

  return { summary, quotes, actionTaken: "none", checkedAt };
}
