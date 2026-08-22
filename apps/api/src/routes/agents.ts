import { Hono } from "hono";
import { createServerClient } from "@rangebook/db";
import type { AgentMetric, AgentCategory } from "@rangebook/db";
import { privateKeyToAccount } from "viem/accounts";

export const agentsRoute = new Hono();

// GET /agents?category=rebalancing
agentsRoute.get("/", async (c) => {
  const category = c.req.query("category");
  const db = createServerClient();

  let query = db.from("agents").select("*, agent_metrics(*)").eq("status", "live");
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  const agents = (data ?? []).map((agent: any) => ({
    ...agent,
    agent_metrics: undefined,
    metrics: latestByKey(agent.agent_metrics ?? []),
    sessionSignerAddress: sessionSignerAddressFor(agent.category),
  }));

  return c.json({ agents });
});

// GET /agents/:id
agentsRoute.get("/:id", async (c) => {
  const db = createServerClient();
  const { data, error } = await db
    .from("agents")
    .select("*, agent_metrics(*)")
    .eq("id", c.req.param("id"))
    .single();

  if (error) return c.json({ error: error.message }, 404);

  const agent = {
    ...data,
    agent_metrics: undefined,
    metrics: latestByKey(data.agent_metrics ?? []),
    sessionSignerAddress: sessionSignerAddressFor(data.category),
  };

  return c.json({ agent });
});

/** Collapses the raw metrics history down to one current value per metric_key. */
function latestByKey(metrics: AgentMetric[]): Record<string, AgentMetric> {
  const byKey: Record<string, AgentMetric> = {};
  for (const m of metrics) {
    const existing = byKey[m.metric_key];
    if (!existing || new Date(m.recorded_at) > new Date(existing.recorded_at)) {
      byKey[m.metric_key] = m;
    }
  }
  return byKey;
}

// Mirrors packages/a2a-server/src/lib/agentSigner.ts's env-var-per-category
// pattern rather than importing it — apps/api and packages/a2a-server
// don't currently share code in this direction. Worth unifying into one
// shared package if a third caller ever needs this derivation; not worth
// it yet for one.
const ENV_KEY_BY_CATEGORY: Record<AgentCategory, string> = {
  health_factor_monitoring: "AGENT_SIGNER_KEY_HEALTH_FACTOR",
  rebalancing: "AGENT_SIGNER_KEY_REBALANCING",
  grid_trading: "AGENT_SIGNER_KEY_GRID_TRADING",
  yield_optimisation: "AGENT_SIGNER_KEY_YIELD_OPTIMISATION",
};

/**
 * The public address the browser needs to include as `sessionSigner` when
 * granting a session — derived from the same server-held key
 * agentSigner.ts uses to actually execute later. The private key never
 * leaves the server; only the address it corresponds to does.
 */
function sessionSignerAddressFor(category: AgentCategory): `0x${string}` | null {
  const envKey = ENV_KEY_BY_CATEGORY[category];
  const privateKey = process.env[envKey];
  if (!privateKey) return null;
  try {
    return privateKeyToAccount(privateKey as `0x${string}`).address;
  } catch {
    return null;
  }
}
