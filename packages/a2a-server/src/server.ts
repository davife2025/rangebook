import express, { type Express } from "express";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from "@a2a-js/sdk/server/express";
import { buildAgentCard } from "./agentCard";
import { RangebookExecutor } from "./rangebookExecutor";
import { x402Guard } from "./lib/x402Guard";

/**
 * InMemoryTaskStore means task history doesn't survive a restart — fine
 * for the hackathon demo, worth swapping for a real store (Supabase,
 * matching the pattern everything else in this repo already uses) before
 * this needs to hold state across deploys.
 */
export function createA2AApp(): Express {
  const agentCard = buildAgentCard();
  const requestHandler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), new RangebookExecutor());

  const app = express();
  app.use(express.json());

  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));

  const payGuard = x402Guard({
    payTo: (process.env.A2A_PAYTO_ADDRESS ?? "0x0") as `0x${string}`,
    amount: process.env.A2A_PRICE_PER_TASK ?? "0.10",
    token: process.env.A2A_PAYMENT_TOKEN ?? "USDT",
    // ALTANA_ENV is "testnet" | "mainnet" throughout this repo (see
    // packages/altana/src/session.ts) — map it the same way here rather
    // than reintroducing the "bnb"/"bnb-testnet" SDK-internal naming.
    network: process.env.ALTANA_ENV === "mainnet" ? "bnb" : "bnb-testnet",
  });

  app.use("/jsonrpc", payGuard, jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
  app.use("/rest", payGuard, restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

  return app;
}
