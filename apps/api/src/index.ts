import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agentsRoute } from "./routes/agents";
import { sessionsRoute } from "./routes/sessions";

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

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`rangebook-api listening on http://localhost:${info.port}`);
});
