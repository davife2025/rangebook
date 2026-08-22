import { createServerClient } from "@rangebook/db";
import type { AgentCategory } from "@rangebook/db";
import { isSessionValid } from "@rangebook/altana";

export interface ActiveSession {
  sessionKeyAddress: `0x${string}`;
  expiresAt: Date;
}

/**
 * Same rule as the Permissions dashboard: sessions_cache is for instant
 * reads, never the final word. A session that looks active in the cache
 * but has been revoked directly against Keystore (possible — revoke is
 * always available onchain, independent of our UI) must not be treated
 * as usable here.
 */
export async function getActiveSessionForWallet(
  walletAddress: `0x${string}`,
  category: AgentCategory,
): Promise<ActiveSession | null> {
  const db = createServerClient();

  const { data, error } = await db
    .from("sessions_cache")
    .select("*, agents!inner(category)")
    .eq("user_wallet_address", walletAddress)
    .eq("agents.category", category)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const sessionKeyAddress = data.session_key_address as `0x${string}`;
  const stillValid = await isSessionValid(sessionKeyAddress);
  if (!stillValid) return null;

  return { sessionKeyAddress, expiresAt: new Date(data.expires_at) };
}
