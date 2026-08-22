import { Hono } from "hono";
import { createServerClient } from "@rangebook/db";
import { activateAgent, revokeAgentSession } from "@rangebook/altana";
import type { AgentCategory } from "@rangebook/db";

export const sessionsRoute = new Hono();

// GET /sessions?wallet=0x...
// Reads sessions_cache for instant paint. The dashboard re-verifies each
// one against Keystore (isSessionValid) before treating "revoke" as safe to
// show as actionable — this endpoint alone is not that check.
sessionsRoute.get("/", async (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet query param is required" }, 400);

  const db = createServerClient();
  const { data, error } = await db
    .from("sessions_cache")
    .select("*, agents(name, category)")
    .eq("user_wallet_address", wallet)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ sessions: data });
});

interface ActivateBody {
  category: AgentCategory;
  agentId: string;
  userWalletAddress: `0x${string}`;
  userAdminSigner: unknown;
  agentSessionSigner: `0x${string}`;
}

// POST /sessions/activate
sessionsRoute.post("/activate", async (c) => {
  const body = await c.req.json<ActivateBody>();

  const result = await activateAgent({
    category: body.category,
    userWalletAddress: body.userWalletAddress,
    userAdminSigner: body.userAdminSigner,
    agentSessionSigner: body.agentSessionSigner,
  });

  const db = createServerClient();
  const { error } = await db.from("sessions_cache").insert({
    user_wallet_address: body.userWalletAddress,
    agent_id: body.agentId,
    session_key_address: result.sessionKeyAddress,
    calls: [],
    expires_at: result.expiresAt.toISOString(),
    keystore_tx_hash: result.keystoreTxHash,
  });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ session: result });
});

// POST /sessions/:sessionKeyAddress/revoke
sessionsRoute.post("/:sessionKeyAddress/revoke", async (c) => {
  const sessionKeyAddress = c.req.param("sessionKeyAddress") as `0x${string}`;
  const result = await revokeAgentSession(sessionKeyAddress);

  const db = createServerClient();
  await db
    .from("sessions_cache")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_key_address", sessionKeyAddress);

  return c.json({ revoked: true, txHash: result.txHash });
});
