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

function client(): AltanaClient {
  const apiKey = requireEnv("ALTANA_API_KEY");
  const env = (process.env.ALTANA_ENV ?? "testnet") as "testnet" | "mainnet";
  return new AltanaClient({ apiKey, network: env === "mainnet" ? "bnb" : "bnb-testnet" });
}

export interface ActivateAgentParams {
  category: AgentCategory;
  userWalletAddress: `0x${string}`;
  userAdminSigner: unknown; // the user's connected signer, passed through from apps/web
  agentSessionSigner: `0x${string}`; // this agent's dedicated session-key address
}

export interface ActivateAgentResult {
  sessionKeyAddress: `0x${string}`;
  expiresAt: Date;
  keystoreTxHash: `0x${string}`;
}

/** "Activate" in the marketplace UI — grants a scoped session, registered in Keystore. */
export async function activateAgent(params: ActivateAgentParams): Promise<ActivateAgentResult> {
  const config = CATEGORY_SKILLS[params.category];
  const altana = client();

  const expiresAt = Math.floor(Date.now() / 1000) + config.defaultExpirySeconds;

  const session = await altana.grantSession({
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
  const altana = client();
  const result = await altana.revokeSession({ sessionKey: sessionKeyAddress });
  return { txHash: result.txHash };
}

/** Re-verifies a session directly against Keystore — never trust sessions_cache alone. */
export async function isSessionValid(sessionKeyAddress: `0x${string}`): Promise<boolean> {
  const altana = client();
  return altana.keystore.isValidKey(sessionKeyAddress);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
