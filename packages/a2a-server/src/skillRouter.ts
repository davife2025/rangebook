import type { Message } from "@a2a-js/sdk";
import type { AgentCategory } from "@rangebook/db";

export type SkillId = "monitor-health-factor" | "rebalance-liquidity" | "run-grid" | "optimize-yield";

export const SKILL_TO_CATEGORY: Record<SkillId, AgentCategory> = {
  "monitor-health-factor": "health_factor_monitoring",
  "rebalance-liquidity": "rebalancing",
  "run-grid": "grid_trading",
  "optimize-yield": "yield_optimisation",
};

const SKILL_KEYWORDS: Record<SkillId, string[]> = {
  "monitor-health-factor": ["health factor", "liquidation", "aave", "audit"],
  "rebalance-liquidity": ["rebalance", "liquidity", "lp position", "range"],
  "run-grid": ["grid"],
  "optimize-yield": ["yield", "apr", "best rate", "best yield"],
};

/**
 * A2A's core Message type has no dedicated "which skill" field — skill
 * selection is left to the agent. Structured callers (an orchestrator
 * that already parsed our Agent Card) can set metadata.skillId directly;
 * anyone just writing plain English falls through to keyword matching.
 */
export function resolveSkill(message: Message): SkillId | null {
  const explicit = message.metadata?.skillId;
  if (typeof explicit === "string" && explicit in SKILL_TO_CATEGORY) {
    return explicit as SkillId;
  }

  const text = message.parts
    .filter((p): p is Extract<typeof p, { kind: "text" }> => p.kind === "text")
    .map((p) => p.text)
    .join(" ")
    .toLowerCase();

  for (const [skillId, keywords] of Object.entries(SKILL_KEYWORDS) as [SkillId, string[]][]) {
    if (keywords.some((kw) => text.includes(kw))) return skillId;
  }

  return null;
}

export function extractWalletAddress(message: Message): `0x${string}` | null {
  const text = message.parts
    .filter((p): p is Extract<typeof p, { kind: "text" }> => p.kind === "text")
    .map((p) => p.text)
    .join(" ");
  const match = text.match(/0x[a-fA-F0-9]{40}/);
  return (match?.[0] as `0x${string}`) ?? null;
}
