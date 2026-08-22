import { createA2AApp } from "@rangebook/a2a-server";

/**
 * Runs as its own process, separate from src/index.ts. a2a-js's HTTP glue
 * (agentCardHandler, jsonRpcHandler, restHandler) is Express-specific, and
 * the rest of apps/api is built on Hono — rather than re-implement A2A's
 * JSON-RPC and REST bindings by hand to force it onto Hono, this runs
 * alongside the main API as a second listener. Both scripts live under
 * apps/api; there's no third top-level app.
 */
const app = createA2AApp();
const port = Number(process.env.A2A_PORT ?? 8788);

app.listen(port, () => {
  console.log(`rangebook-a2a listening on http://localhost:${port}`);
  console.log(`Agent Card at http://localhost:${port}/.well-known/agent-card.json`);
});
