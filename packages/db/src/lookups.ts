import { createServerClient } from "./client";
import type { RebalancingPosition, GridConfigRow } from "./types";

export async function getTrackedPosition(walletAddress: string): Promise<RebalancingPosition | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("rebalancing_positions")
    .select("*")
    .eq("user_wallet_address", walletAddress)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return error || !data ? null : data;
}

export async function getGridConfig(walletAddress: string): Promise<GridConfigRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from("grid_configs")
    .select("*")
    .eq("user_wallet_address", walletAddress)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return error || !data ? null : data;
}
