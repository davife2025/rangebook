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

## Session 2 — Health Factor Monitoring, real logic

**Added**

- `packages/agent-health-factor` — new package: `monitor.ts` (real Aave V3
  health-factor read; Venus explicitly left unimplemented, see the comment
  above `checkVenusAccountLiquidity` for why it's not a drop-in swap),
  `defend.ts` (repay through the session), `task.ts`
  (`fulfillAuditJob` — the ERC-8183 job handler, matching Altana's own
  example task almost verbatim), `cli-check.ts` (manual smoke test)
- `AGENT_BRIEF.md` — the literal brief to paste into Cursor per Agent
  Studio's documented workflow
- `DEPLOY.md` — full runbook, testnet faucet through first real session

**Changed**

- `packages/altana/src/session.ts` — added `executeViaSession`, missing
  from session 1; this is what every agent's actual action runs through
  after activation
- `apps/api/src/routes/sessions.ts` — added `GET /sessions?wallet=`, needed
  by the dashboard and missing from session 1
- `apps/web/app/permissions/page.tsx` — rebuilt as a real client component:
  fetches live sessions, wires Revoke to the actual endpoint. Wallet
  connection itself is still a text-input stand-in, not a real connect flow

**Not started yet**

- Real wallet connection (Altana/wagmi) — Permissions page takes a pasted
  address for now
- Venus support in `monitor.ts`
- Precise repay sizing in `task.ts` — currently a fixed conservative step,
  not a computed optimum (see the comment on `fulfillAuditJob`)
- Nothing in this session has actually run — same network caveat as
  session 1
