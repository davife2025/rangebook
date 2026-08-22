import type { AgentCard } from "@a2a-js/sdk";

/**
 * One card for the whole marketplace rather than four separate ones —
 * simpler to serve, and A2A's AgentSkill array is exactly meant for this
 * (one agent, several distinct capabilities). If a reason shows up later
 * to give each category its own independently-deployed A2A endpoint, this
 * card's `skills` array is what splits into four.
 */
export function buildAgentCard(): AgentCard {
  const baseUrl = requireEnv("A2A_PUBLIC_URL"); // e.g. https://api.rangebook.xyz/a2a

  return {
    name: "Rangebook",
    description:
      "BNB Chain DeFi agents that act inside a scoped, revocable onchain session — rebalancing, grid trading, yield routing, and liquidation defense.",
    protocolVersion: "0.3.0",
    version: "0.1.0",
    url: `${baseUrl}/jsonrpc`,
    additionalInterfaces: [
      { url: `${baseUrl}/jsonrpc`, transport: "JSONRPC" },
      { url: `${baseUrl}/rest`, transport: "HTTP+JSON" },
    ],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
      extensions: [
        {
          uri: "urn:rangebook:extensions:erc8004:v1",
          description: "Cross-reference to this agent's onchain ERC-8004 identity, verifiable on 8004scan.",
          required: false,
          params: {
            chainId: 56,
            // Set once agents are actually deployed via the Agent Studio
            // CLI — deliberately not hardcoded here.
            erc8004AgentId: process.env.AGENT_STUDIO_MARKETPLACE_ERC8004_ID ?? null,
            verifyUrl: process.env.AGENT_STUDIO_MARKETPLACE_ERC8004_ID
              ? `https://8004scan.io/agents/${process.env.AGENT_STUDIO_MARKETPLACE_ERC8004_ID}?chain=56`
              : null,
          },
        },
      ],
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "monitor-health-factor",
        name: "Health Factor Monitoring",
        description:
          "Audits a wallet's Aave V3 position and repays debt through its active session if the health factor is below a safe threshold.",
        tags: ["defi", "lending", "risk", "aave"],
      },
      {
        id: "rebalance-liquidity",
        name: "Rebalancing",
        description: "Checks a PancakeSwap concentrated liquidity position and recenters it if price has moved out of range.",
        tags: ["defi", "liquidity", "pancakeswap"],
      },
      {
        id: "run-grid",
        name: "Grid Trading",
        description: "Checks a configured price grid against the current market and executes any newly-triggered level.",
        tags: ["defi", "trading", "pancakeswap"],
      },
      {
        id: "optimize-yield",
        name: "Yield Optimisation",
        description: "Compares real supply APR across Aave V3 and Venus and reports whether moving would be worthwhile.",
        tags: ["defi", "yield", "lending"],
      },
    ],
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
