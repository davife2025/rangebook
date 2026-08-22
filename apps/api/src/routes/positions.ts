import { Hono } from "hono";
import { createServerClient } from "@rangebook/db";

export const positionsRoute = new Hono();

// POST /positions/rebalancing
positionsRoute.post("/rebalancing", async (c) => {
  const body = await c.req.json<{
    agentId: string;
    walletAddress: string;
    positionTokenId: string;
    positionManagerAddress: string;
    rangeWidthTicks?: number;
  }>();

  const db = createServerClient();
  const { data, error } = await db
    .from("rebalancing_positions")
    .upsert(
      {
        agent_id: body.agentId,
        user_wallet_address: body.walletAddress,
        position_token_id: body.positionTokenId,
        position_manager_address: body.positionManagerAddress,
        range_width_ticks: body.rangeWidthTicks ?? 2000,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_wallet_address,position_token_id" },
    )
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ position: data });
});

// GET /positions/rebalancing?wallet=0x...
positionsRoute.get("/rebalancing", async (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet query param is required" }, 400);

  const db = createServerClient();
  const { data, error } = await db
    .from("rebalancing_positions")
    .select("*")
    .eq("user_wallet_address", wallet)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ position: data });
});

// POST /positions/grid
positionsRoute.post("/grid", async (c) => {
  const body = await c.req.json<{
    agentId: string;
    walletAddress: string;
    baseToken: string;
    quoteToken: string;
    universalRouterAddress: string;
    levels: { price: number; side: "buy" | "sell"; filled: boolean }[];
    amountPerLevel: number;
  }>();

  const db = createServerClient();
  const { data, error } = await db
    .from("grid_configs")
    .insert({
      agent_id: body.agentId,
      user_wallet_address: body.walletAddress,
      base_token: body.baseToken,
      quote_token: body.quoteToken,
      universal_router_address: body.universalRouterAddress,
      levels: body.levels,
      amount_per_level: body.amountPerLevel,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ config: data });
});

// GET /positions/grid?wallet=0x...
positionsRoute.get("/grid", async (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet query param is required" }, 400);

  const db = createServerClient();
  const { data, error } = await db
    .from("grid_configs")
    .select("*")
    .eq("user_wallet_address", wallet)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ config: data });
});
