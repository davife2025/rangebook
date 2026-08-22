import { Hono } from "hono";
import { createServerClient } from "@rangebook/db";
import { revokeAgentSession } from "@rangebook/altana";

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

interface RecordGrantBody {
  agentId: string;
  userWalletAddress: `0x${string}`;
  sessionKeyAddress: `0x${string}`;
  expiresAt: string; // ISO — from ActivateAgentResult, already computed client-side
  keystoreTxHash: `0x${string}`;
}

/**
 * POST /sessions/activate — despite the name, this never grants a
 * session; it records one that the browser already granted. See the note
 * on activateAgent in packages/altana/src/session.ts for why: a server
 * can't sign with a user's admin key without becoming the custodian this
 * whole architecture exists to avoid, so the actual altana.grantSession()
 * call happens client-side, in apps/web's ActivateForm, with the
 * connected wallet. This endpoint's only job is to write the result —
 * already real, already on Keystore — into sessions_cache so the
 * Permissions dashboard has something to read.
 */
sessionsRoute.post("/activate", async (c) => {
  const body = await c.req.json<RecordGrantBody>();

  const db = createServerClient();
  const { error } = await db.from("sessions_cache").insert({
    user_wallet_address: body.userWalletAddress,
    agent_id: body.agentId,
    session_key_address: body.sessionKeyAddress,
    calls: [],
    expires_at: body.expiresAt,
    keystore_tx_hash: body.keystoreTxHash,
  });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ recorded: true });
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
