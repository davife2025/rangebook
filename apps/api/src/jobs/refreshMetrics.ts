import { createServerClient } from "@rangebook/db";
import type { Agent, AgentMetric } from "@rangebook/db";
import { Scan8004Client } from "@rangebook/chain";
import { getAaveSupplyApr, getVenusSupplyApr } from "@rangebook/agent-yield-optimisation";

type NewMetric = Omit<AgentMetric, "id" | "recorded_at">;

/**
 * Refreshes agent_metrics for every `live` agent. Two things worth being
 * honest about:
 *
 * 1. Rebalancing, Grid Trading, and Health Factor Monitoring don't have an
 *    agent-agnostic "market" number to show pre-activation — a health
 *    factor or an LP range only means something for a specific user's
 *    position, and there's no user yet at browse time. Rather than invent
 *    a placeholder, those three show 8004scan reputation only, until
 *    there's real hire history.
 * 2. Yield Optimisation gets a real market number (best APR available
 *    right now) because that genuinely doesn't need a user — it's the
 *    same for anyone asking.
 *
 * Failures are per-agent and per-source: one bad read shouldn't blank out
 * every other agent's card.
 */
export async function refreshAgentMetrics(): Promise<{ refreshed: number; failed: number }> {
  const db = createServerClient();
  const { data: agents, error } = await db.from("agents").select("*").eq("status", "live");

  if (error || !agents) {
    console.error("refreshAgentMetrics: could not load agents", error);
    return { refreshed: 0, failed: 0 };
  }

  let refreshed = 0;
  let failed = 0;

  for (const agent of agents as Agent[]) {
    try {
      const metrics = await collectMetrics(agent);
      if (metrics.length > 0) {
        const { error: insertError } = await db.from("agent_metrics").insert(metrics);
        if (insertError) throw insertError;
      }
      refreshed++;
    } catch (err) {
      console.error(`refreshAgentMetrics: failed for agent ${agent.id} (${agent.category})`, err);
      failed++;
    }
  }

  return { refreshed, failed };
}

async function collectMetrics(agent: Agent): Promise<NewMetric[]> {
  const metrics: NewMetric[] = [];

  if (agent.erc8004_agent_id) {
    try {
      const scan = new Scan8004Client();
      const identity = await scan.getAgent(agent.erc8004_agent_id);

      if (typeof identity.reputationScore === "number") {
        metrics.push({
          agent_id: agent.id,
          metric_key: "reputation_score",
          metric_value: identity.reputationScore,
          metric_label: `${identity.reputationScore.toFixed(1)} reputation`,
          source: "8004scan",
        });
      }
      if (typeof identity.feedbackCount === "number") {
        metrics.push({
          agent_id: agent.id,
          metric_key: "feedback_count",
          metric_value: identity.feedbackCount,
          metric_label: `${identity.feedbackCount} job${identity.feedbackCount === 1 ? "" : "s"} rated`,
          source: "8004scan",
        });
      }
    } catch (err) {
      console.error(`collectMetrics: 8004scan lookup failed for ${agent.id}`, err);
    }
  }

  if (agent.category === "yield_optimisation") {
    try {
      const aaveAsset = requireEnv("YIELD_REFERENCE_AAVE_ASSET") as `0x${string}`;
      const venusVToken = requireEnv("YIELD_REFERENCE_VENUS_VTOKEN") as `0x${string}`;

      const [aaveApr, venusApr] = await Promise.all([
        getAaveSupplyApr(aaveAsset),
        getVenusSupplyApr(venusVToken),
      ]);

      const best = Math.max(aaveApr, venusApr);
      const bestVenue = aaveApr >= venusApr ? "Aave" : "Venus";

      metrics.push({
        agent_id: agent.id,
        metric_key: "best_apr",
        metric_value: best,
        metric_label: `${best.toFixed(1)}% best APR (${bestVenue})`,
        source: "chain_read",
      });
    } catch (err) {
      console.error(`collectMetrics: yield rate read failed for ${agent.id}`, err);
    }
  }

  // rebalancing, grid_trading, health_factor_monitoring: see the function
  // doc comment above — nothing agent-agnostic to add yet.

  return metrics;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
