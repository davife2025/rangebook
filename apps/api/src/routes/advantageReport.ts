import { Hono } from "hono";
import { createServerClient } from "@rangebook/db";

export const advantageReportRoute = new Hono();

// GET /advantage-report/tasks
advantageReportRoute.get("/tasks", async (c) => {
  const db = createServerClient();
  const { data, error } = await db
    .from("advantage_report_tasks")
    .select("*, agents(name, category)")
    .order("created_at", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ tasks: data });
});

// POST /advantage-report/tasks — create a task, typically before the
// "without agent" arm has been run yet (fill that in later via PATCH).
advantageReportRoute.post("/tasks", async (c) => {
  const body = await c.req.json();

  const db = createServerClient();
  const { data, error } = await db
    .from("advantage_report_tasks")
    .insert({
      agent_id: body.agentId,
      task_title: body.taskTitle,
      task_description: body.taskDescription,
      is_trading_stock_or_security: body.isTradingStockOrSecurity ?? false,
      window_start: body.windowStart ?? null,
      window_end: body.windowEnd ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ task: data });
});

// PATCH /advantage-report/tasks/:id — fill in results for either arm as
// they come in; the two arms rarely finish at the same time.
advantageReportRoute.patch("/tasks/:id", async (c) => {
  const body = await c.req.json();
  const db = createServerClient();

  const update: Record<string, unknown> = {};
  const fieldMap: Record<string, string> = {
    withAgentTimeSeconds: "with_agent_time_seconds",
    withAgentCostUsd: "with_agent_cost_usd",
    withAgentOutput: "with_agent_output",
    withAgentOutputUrl: "with_agent_output_url",
    withAgentQualityScore: "with_agent_quality_score",
    withoutAgentTimeSeconds: "without_agent_time_seconds",
    withoutAgentCostUsd: "without_agent_cost_usd",
    withoutAgentOutput: "without_agent_output",
    withoutAgentOutputUrl: "without_agent_output_url",
    withoutAgentQualityScore: "without_agent_quality_score",
    qualityRubricNotes: "quality_rubric_notes",
    winRatePct: "win_rate_pct",
    riskDescription: "risk_description",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in body) update[column] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return c.json({ error: "No recognized fields in body" }, 400);
  }

  const { data, error } = await db
    .from("advantage_report_tasks")
    .update(update)
    .eq("id", c.req.param("id"))
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ task: data });
});
