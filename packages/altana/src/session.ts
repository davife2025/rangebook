import { AltanaClient } from "@altananetwork/sdk";
import type { AgentCategory } from "@rangebook/db";
import { CATEGORY_SKILLS, contractsFor } from "./skills";

/**
 * NOTE: written against the documented shape of @altananetwork/sdk
 * (grantSession / execute / revokeSession, permissions.calls + spend +
 * expiry, sessions registered in Keystore automatically on grant). This
 * package has not been run yet — this environment has no network access to
 * install or exercise it. Treat this file as the contract to verify against
 * the real SDK on first run, not as already-tested code.
 *
 * The wallet being acted on is always the USER's Altana wallet, never a
 * separate "agent wallet" — that's what makes the session visible and
 * revocable by the person whose funds are at stake. The agent only ever
 * holds the session key, scoped by the category's skill config.
 */

function serverClient(): AltanaClient {
  const apiKey = requireEnv("ALTANA_API_KEY");
  const env = (process.env.ALTANA_ENV ?? "testnet") as "testnet" | "mainnet";
  return new AltanaClient({ apiKey, network: env === "mainnet" ? "bnb" : "bnb-testnet" });
}

export interface ActivateAgentParams {
  category: AgentCategory;
  userWalletAddress: `0x${string}`;
  userAdminSigner: unknown; // the connected wallet's signer — only ever real in a browser
  agentSessionSigner: `0x${string}`; // this agent's dedicated session-key address
  altanaClient: AltanaClient; // caller constructs this — see the note below on why
}

export interface ActivateAgentResult {
  sessionKeyAddress: `0x${string}`;
  expiresAt: Date;
  keystoreTxHash: `0x${string}`;
}

/**
 * "Activate" in the marketplace UI — grants a scoped session, registered
 * in Keystore.
 *
 * CORRECTED THIS SESSION: this used to construct its own AltanaClient
 * from server-side env vars, which meant the only real caller
 * (apps/api's old POST /sessions/activate) was asking a server to sign
 * with the *user's* admin key — a key a server can never actually hold
 * without becoming the custodian the whole Altana track exists to avoid.
 * Granting a session needs the owner's real signature, which only exists
 * in the browser where their wallet lives. So this function now takes an
 * already-constructed `altanaClient` rather than building one from
 * process.env — the only correct caller is apps/web's ActivateForm,
 * client-side, with a connected wallet. The server's role (see
 * apps/api/src/routes/sessions.ts) is to *record* the result of a grant
 * that already happened, never to perform one.
 */
export async function activateAgent(params: ActivateAgentParams): Promise<ActivateAgentResult> {
  const config = CATEGORY_SKILLS[params.category];
  const expiresAt = Math.floor(Date.now() / 1000) + config.defaultExpirySeconds;

  const session = await params.altanaClient.grantSession({
    wallet: params.userWalletAddress,
    signer: params.userAdminSigner,
    sessionSigner: params.agentSessionSigner,
    permissions: {
      calls: contractsFor(params.category).map((to) => ({ to })),
      spend: [
        {
          limit: config.defaultSpend.limit,
          token: config.defaultSpend.token,
          period: config.defaultSpend.period,
        },
      ],
    },
    expiry: expiresAt,
  });

  return {
    sessionKeyAddress: params.agentSessionSigner,
    expiresAt: new Date(expiresAt * 1000),
    keystoreTxHash: session.txHash,
  };
}

/** The Permissions dashboard's "revoke" button — one transaction, effective immediately. */
export async function revokeAgentSession(sessionKeyAddress: `0x${string}`): Promise<{ txHash: `0x${string}` }> {
  const altana = serverClient();
  const result = await altana.revokeSession({ sessionKey: sessionKeyAddress });
  return { txHash: result.txHash };
}

/** Re-verifies a session directly against Keystore — never trust sessions_cache alone. */
export async function isSessionValid(sessionKeyAddress: `0x${string}`): Promise<boolean> {
  const altana = serverClient();
  return altana.keystore.isValidKey(sessionKeyAddress);
}

export interface ExecuteViaSessionParams {
  sessionKeyAddress: `0x${string}`;
  sessionSigner: unknown; // the agent's own key for this session — never the user's admin key
  calls: { to: `0x${string}`; data: `0x${string}`; value?: bigint }[];
}

/**
 * How every agent actually acts, after activation: calls out through an
 * already-granted session rather than requesting a new one. Reverts
 * on-chain at validation if `calls` reaches outside what was granted —
 * there's no separate check to remember to write here. This one
 * correctly stays server-side: it signs with the *agent's* key (see
 * agentSigner.ts), never the user's.
 */
export async function executeViaSession(
  params: ExecuteViaSessionParams,
): Promise<{ txHash: `0x${string}` }> {
  const altana = serverClient();
  const result = await altana.execute({
    sessionKey: params.sessionKeyAddress,
    signer: params.sessionSigner,
    calls: params.calls,
  });
  return { txHash: result.txHash };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
