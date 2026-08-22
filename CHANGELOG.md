# Changelog

Each entry corresponds to one build session's zip. Session 1 is the full
tree; every session after ships only what's new or changed, listed here so
a zip is self-documenting on its own.

## Session 1 — core infrastructure and architecture

**Added**

- Monorepo scaffold: pnpm workspaces + Turborepo, shared `tsconfig.base.json`
- `packages/db` — Supabase schema (`agents`, `agent_metrics`,
  `sessions_cache`, `advantage_report_tasks`, `user_profiles`), RLS
  policies, hand-written types, client factory (server + browser)
- `packages/chain` — viem clients for BSC mainnet/testnet, 8004scan API
  client, minimal read-only ABIs
- `packages/altana` — category → skill mapping for all 4 agents (allowlist
  pattern, spend cap, expiry, explicit `mayNot` boundaries), session
  lifecycle wrapper (`activateAgent`, `revokeAgentSession`, `isSessionValid`)
- `packages/ui` — design tokens, the `Bound`/`CountdownBound` signature
  component, `Button`, `Card`
- `apps/web` — Next.js app: marketplace landing page (hero, 4 category
  cards, activation steps, trust strip), Permissions dashboard stub
- `apps/api` — Hono server: `/health`, `/agents`, `/agents/:id`,
  `/sessions/activate`, `/sessions/:key/revoke`
- Root `README.md`, `.env.example`

**Decisions made**

- Working name: Rangebook
- Design direction: dark graphite base, brass + signal-teal accents, Space
  Grotesk/Inter/JetBrains Mono — full reasoning in the chat session, not
  duplicated here
- Design tooling: skipped a separate Figma pass, designing directly in code
- Sessions always act on the user's Altana wallet, never a separate
  agent-owned wallet — see `packages/altana/src/session.ts`

**Not started yet**

- No agent is actually deployed via the Agent Studio CLI
- `apps/api` routes are unrun — first real target for session 2
- ERC-8183 job fulfillment, x402 sell endpoints
- Agent Advantage Report tasks (schema exists, no data)
