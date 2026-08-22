import { Hono } from "hono";
import { createServerClient } from "@rangebook/db";

export const agentsRoute = new Hono();

// GET /agents?category=rebalancing
agentsRoute.get("/", async (c) => {
  const category = c.req.query("category");
  const db = createServerClient();

  let query = db.from("agents").select("*, agent_metrics(*)").eq("status", "live");
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ agents: data });
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
  return c.json({ agent: data });
});
