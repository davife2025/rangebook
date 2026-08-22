import { privateKeyToAccount } from "viem/accounts";
import type { AgentCategory } from "@rangebook/db";

/**
 * TESTNET-ONLY PATTERN. Whoever calls executeViaSession needs a real
 * signer for the session key, and this is the one piece of the whole A2A
 * layer that's genuinely new state, not just an adapter over existing
 * work — nothing before this session addressed key custody at all.
 *
 * Reading a private key from an env var is fine for a hackathon testnet
 * demo and not fine for anything past it. Real custody — AWS KMS, a
 * proper secrets manager, or better, having Agent Studio's own AWS
 * AgentCore runtime hold and use the key instead of apps/api ever
 * touching it — is a real gap, not an oversight to wave off. Don't deploy
 * this pattern against mainnet funds.
 */
const ENV_KEY_BY_CATEGORY: Record<AgentCategory, string> = {
  health_factor_monitoring: "AGENT_SIGNER_KEY_HEALTH_FACTOR",
  rebalancing: "AGENT_SIGNER_KEY_REBALANCING",
  grid_trading: "AGENT_SIGNER_KEY_GRID_TRADING",
  yield_optimisation: "AGENT_SIGNER_KEY_YIELD_OPTIMISATION",
};

export function getAgentSessionSigner(category: AgentCategory) {
  const envKey = ENV_KEY_BY_CATEGORY[category];
  const privateKey = process.env[envKey];
  if (!privateKey) {
    throw new Error(`${envKey} is not set — see the custody note in this file before deploying anywhere real.`);
  }
  return privateKeyToAccount(privateKey as `0x${string}`);
}
