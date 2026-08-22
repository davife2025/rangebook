import { Hono } from "hono";
import { createServerClient } from "@rangebook/db";
import { activateAgent, revokeAgentSession } from "@rangebook/altana";
import type { AgentCategory } from "@rangebook/db";

export const sessionsRoute = new Hono();

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
