import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agentsRoute } from "./routes/agents";
import { sessionsRoute } from "./routes/sessions";
import { refreshAgentMetrics } from "./jobs/refreshMetrics";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "rangebook-api" }));

app.route("/agents", agentsRoute);
app.route("/sessions", sessionsRoute);

// Manual trigger — useful for testing the refresh without waiting on the
// interval below, e.g. right after deploying an agent.
app.post("/admin/refresh-metrics", async (c) => {
  const result = await refreshAgentMetrics();
  return c.json(result);
});

const port = Number(process.env.PORT ?? 8787);
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`rangebook-api listening on http://localhost:${info.port}`);

  refreshAgentMetrics().catch((err) => console.error("Initial metrics refresh failed:", err));
  setInterval(() => {
    refreshAgentMetrics().catch((err) => console.error("Scheduled metrics refresh failed:", err));
  }, REFRESH_INTERVAL_MS);
});
