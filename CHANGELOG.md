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

## Session 3 — the other three agents, same bar

**Added**

- `packages/agent-rebalancing` — `monitor.ts` (real range-check and
  recentering math), `rebalance.ts` + the position read in `monitor.ts`
  explicitly NOT implemented: PancakeSwap Infinity's CLAMM turned out to
  use a singleton `CLPositionManager` (see
  `pancakeswap/infinity-periphery` on GitHub) with Permit2-gated calls —
  a real architecture difference from classic V3, confirmed by research
  this session, not assumed. `task.ts` job handler.
- `packages/agent-grid-trading` — `grid.ts` (real, pure state-machine
  logic for which levels a price move triggers — no chain calls, easy to
  test alone), `execute.ts` explicitly deferred to the Altana PancakeSwap
  Trading skill rather than hand-rolling Universal Router command
  encoding, `task.ts` job handler.
- `packages/agent-yield-optimisation` — `rates.ts` (Aave V3 and Venus
  supply APR, both real reads), `compare.ts` (real routing decision),
  `reallocate.ts` (real atomic withdraw+supply pattern, calldata supplied
  by caller), `task.ts` job handler. Lista APR and PancakeSwap LP fee APR
  explicitly NOT implemented — both need a data source beyond a single
  contract read.
- `AGENT_BRIEF.md` for each, same pattern as session 2

**Decisions made**

- Different agents get different confidence treatment on purpose: Aave/
  Venus rate reads and the health-factor logic are written as real,
  working code; PancakeSwap Infinity's position calls and Universal
  Router's swap encoding are explicitly stubbed rather than guessed,
  because actual research this session turned up real architecture I
  don't have verified, precise knowledge of. Better to flag that
  honestly than ship a plausible-looking wrong ABI.
- Every stub points at a specific, real source to build against (a GitHub
  path, a named Altana skill) — never just "TODO"

**Not started yet**

- Same network caveat as sessions 1 and 2 — nothing has run
- The specific stubs listed above, each with its reasoning left in the
  code comment rather than repeated here
- No agent beyond Health Factor Monitoring has an AGENT_BRIEF that's
  actually been fed to Cursor/Agent Studio yet
