import type { AgentCategory } from "@rangebook/db";

/**
 * One entry per category. `contractsEnvKey` points at an env var holding
 * the addresses this session is allowed to call — deliberately NOT
 * hardcoded here. Skill files at skills.altana.network are fork-tested
 * against the live chain and updated as protocols change (PancakeSwap's
 * move to Infinity/Universal Router being the current example); read the
 * current version there before filling these in, rather than trusting
 * addresses written into this file on any given day.
 */
export interface CategorySkillConfig {
  category: AgentCategory;
  altanaSkills: string[];
  contractsEnvKey: string;
  defaultSpend: { limit: string; token: "USDT" | "BUSD" | "BNB"; period: "day" };
  defaultExpirySeconds: number;
  mayNot: string[];
}

export const CATEGORY_SKILLS: Record<AgentCategory, CategorySkillConfig> = {
  rebalancing: {
    category: "rebalancing",
    altanaSkills: ["pancakeswap-liquidity"],
    contractsEnvKey: "ALTANA_ALLOWLIST_PANCAKESWAP_LIQUIDITY",
    defaultSpend: { limit: "500", token: "USDT", period: "day" },
    defaultExpirySeconds: 24 * 60 * 60,
    mayNot: ["swap outside this pool", "touch any other pool or token"],
  },
  grid_trading: {
    category: "grid_trading",
    // Grid trading is agent-side state on top of a plain swap skill — there
    // is no native grid-order primitive on an AMM, so don't design the
    // session as if one exists.
    altanaSkills: ["pancakeswap-trading", "token-radar"],
    contractsEnvKey: "ALTANA_ALLOWLIST_PANCAKESWAP_TRADING",
    defaultSpend: { limit: "300", token: "USDT", period: "day" },
    defaultExpirySeconds: 24 * 60 * 60,
    mayNot: ["trade any pair outside the configured grid", "exceed the slippage floor"],
  },
  yield_optimisation: {
    category: "yield_optimisation",
    altanaSkills: ["aave-v3-lending", "venus-lending", "lista-liquid-staking", "pancakeswap-liquidity"],
    contractsEnvKey: "ALTANA_ALLOWLIST_YIELD_VENUES",
    defaultSpend: { limit: "1000", token: "USDT", period: "day" },
    defaultExpirySeconds: 24 * 60 * 60,
    mayNot: ["borrow", "use leverage", "touch a venue outside the configured four"],
  },
  health_factor_monitoring: {
    category: "health_factor_monitoring",
    altanaSkills: ["aave-v3-lending", "venus-lending"],
    contractsEnvKey: "ALTANA_ALLOWLIST_LENDING_DEFENSE",
    defaultSpend: { limit: "200", token: "BUSD", period: "day" },
    defaultExpirySeconds: 24 * 60 * 60,
    mayNot: ["borrow more", "withdraw collateral", "send funds anywhere but back to the position"],
  },
};

/** Reads the allowlisted contract addresses for a category from env at call time. */
export function contractsFor(category: AgentCategory): `0x${string}`[] {
  const raw = process.env[CATEGORY_SKILLS[category].contractsEnvKey];
  if (!raw) {
    throw new Error(
      `${CATEGORY_SKILLS[category].contractsEnvKey} is not set — pull current addresses from ` +
        `the relevant skill file at skills.altana.network before granting any session.`,
    );
  }
  return raw.split(",").map((addr) => addr.trim() as `0x${string}`);
}
