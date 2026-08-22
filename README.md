# Rangebook

A BNB Chain agent marketplace. Discover, compare, and activate DeFi agents —
Rebalancing, Grid Trading, Yield Optimisation, Health Factor Monitoring —
each running inside a scoped, revocable onchain permission (an Altana
session) rather than a promise you take on faith.

Built for the BNB Agent Studio Marketplace hackathon: Main track + Altana
partner track + TermiX challenge + PancakeSwap partner challenge, all off
one submission.

## How it's built

```
apps/
  web/      Next.js — the marketplace + Permissions dashboard
  api/      Node + Hono — data aggregation, session orchestration, ERC-8183/x402 endpoints
packages/
  db/         Supabase client, schema, types — cache + product data, NOT the source of truth for permissions
  altana/     grantSession / execute / revokeSession, mapped per agent category
  chain/      viem clients + 8004scan client — live onchain reads
  ui/         shared design system (tokens, Bound, Button, Card)
  a2a-server/ A2A protocol endpoint — lets any A2A-speaking agent (not just BNB-native ones) discover
              and hire the four agents below; a thin adapter over the same task handlers, not new logic
  agent-*/    the actual per-category business logic (health factor, rebalancing, grid, yield)
```

`apps/api` runs as two processes: `pnpm dev` (the main Hono API) and `pnpm dev:a2a` (the A2A/Express
server) — see `packages/a2a-server`'s note on why they're not on one framework.

**The one rule that matters most:** Keystore is always the source of truth
for what an agent may do. `sessions_cache` in Supabase exists so the
Permissions dashboard paints instantly — it is never the final word on
whether a revoke succeeded or a session is still valid. See
`packages/altana/src/session.ts:isSessionValid`.

**Two wallets per agent, not one:** each agent has its own Agent-Studio-
issued identity (ERC-8004 + a TWAK wallet) for its own economics — paying
its own LLM calls, collecting job-escrow or x402 fees. Separately, when a
user activates an agent, the wallet actually being acted on is the *user's*
Altana wallet, with the agent holding a session key scoped against it.
That's what makes a session visible and revocable by the person whose funds
are at stake. Don't build agents with their own separate "trading wallet" —
see `packages/altana/src/session.ts` for the reasoning.

## Status, as of session 7

Real and working:
- The full monorepo, schema (including position/grid tracking and the
  Advantage Report tables), and the marketplace UI, all fetching real
  data where a real source exists
- Health Factor Monitoring and Yield Optimisation — complete, start to
  finish, including the A2A path
- Rebalancing's read side (`monitor.ts`) — confirmed this session against
  PancakeSwap Infinity's real deployed contracts, not inferred
- The A2A endpoint, all four skills routed, Agent Card cross-referencing
  ERC-8004
- `ADVANTAGE_REPORT_METHODOLOGY.md` — the protocol for the required report,
  written before any task was run

Explicitly still stubbed, each with the exact reason in its own file's
comments rather than repeated here: Rebalancing's write
(`rebalance.ts`), Grid Trading's execution (`execute.ts`), the x402
payment gate, real key custody, real wallet connection. See the table in
`DEPLOY.md` before assuming something's broken — most of what doesn't
work yet is a known, named line, not an accident.

Full session-by-session detail in `CHANGELOG.md`.

## Setup

See `DEPLOY.md` — it covers the whole system (all four agents, A2A,
position/grid registration, the Advantage Report) and needs a real,
networked environment; this sandbox can't install packages or reach
testnet.

## Naming

Working name: **Rangebook**. Not locked in — it's a rename away
(`rg -l rangebook` from the root) if you land on something else.
