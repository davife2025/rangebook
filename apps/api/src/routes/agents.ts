import { Hono } from "hono";
import { createServerClient } from "@rangebook/db";
import type { AgentMetric } from "@rangebook/db";

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
