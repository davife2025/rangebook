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
  db/       Supabase client, schema, types — cache + product data, NOT the source of truth for permissions
  altana/   grantSession / execute / revokeSession, mapped per agent category
  chain/    viem clients + 8004scan client — live onchain reads
  ui/       shared design system (tokens, Bound, Button, Card)
```

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

## What's real vs. stubbed in this session

Real, complete code:
- Monorepo tooling (pnpm + Turborepo), all package boundaries and types
- Supabase schema (`packages/db/src/schema.sql`) with RLS policies
- The marketplace landing page, fully designed and coded (`apps/web/app/page.tsx`)
- The Altana session lifecycle wrapper, written against the SDK's documented
  shape (`grantSession` / `execute` / `revokeSession`, Keystore-verified)
- The category → skill mapping or `mayNot` boundaries for all four agents

Stubbed, on purpose, for session 2+:
- No agent is deployed yet — the Permissions dashboard and category stats
  show sample-shaped data, clearly marked in code comments. Nothing here is
  a real onchain number yet.
- `packages/altana` has not been run — this environment has no network
  access to `pnpm install` or hit testnet. Treat it as the contract to
  verify on first real run, not as tested code.
- Contract allowlist addresses are read from env, deliberately not
  hardcoded — pull current addresses from the relevant skill file at
  skills.altana.network before granting a real session, since PancakeSwap's
  move to Infinity/Universal Router means old addresses will silently be
  wrong.
- ERC-8183 job fulfillment and the x402 sell endpoints aren't built yet —
  next session, once one agent has a working session end to end.

## Setup

Needs a real, networked environment (this sandbox can't install packages or
reach testnet) — Claude Code, or your own machine.

```bash
pnpm install
cp .env.example .env   # fill in Supabase, Altana, 8004scan keys
```

Then, against a Supabase project:

```bash
supabase db push          # or paste packages/db/src/schema.sql into the SQL editor
```

Run everything:

```bash
pnpm dev   # turbo runs apps/web on :3000 and apps/api on :8787 together
```

## Naming

Working name: **Rangebook**. Not locked in — it's a rename away
(`rg -l rangebook` from the root) if you land on something else.
