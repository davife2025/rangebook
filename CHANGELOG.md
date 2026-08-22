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

## Session 4 — data layer: real numbers on the marketplace cards

**Added**

- `apps/api/src/jobs/refreshMetrics.ts` — pulls real 8004scan reputation
  for any deployed agent, plus a real live APR comparison (Aave vs Venus)
  for Yield Optimisation. Deliberately does NOT invent a placeholder
  number for Rebalancing, Grid Trading, or Health Factor Monitoring —
  those three only mean something against a specific user's position,
  which doesn't exist pre-activation. Per-agent, per-source try/catch so
  one failed read doesn't blank every card.
- `POST /admin/refresh-metrics` — manual trigger, plus a 5-minute
  background interval started on boot

**Changed**

- `apps/api/src/routes/agents.ts` — responses now collapse metric history
  down to one current value per `metric_key`
- `apps/web/app/page.tsx` — rebuilt as an async server component fetching
  real agent + metric data instead of the hardcoded sample array from
  session 1. Categories with nothing real to show yet render an honest
  "Not deployed yet" state rather than a fake number.
- Hero relabeled from "A REAL SESSION, RIGHT NOW" to "HOW A SESSION
  LOOKS" — showing an actual user's real session on the public homepage
  would mean exposing their data, which isn't something to do even once
  it's technically possible, so the copy shouldn't have implied it either
- `.env.example` — added the reference-asset vars the metrics job needs

**Not started yet**

- Same network caveat as every prior session — nothing has run
- Grid Trading and Rebalancing still have no agent-agnostic market stat;
  worth revisiting once there's a sensible one (e.g. current pair price
  for Grid Trading) rather than leaving both permanently on reputation
  alone
- `/agents/[category]` detail pages don't exist yet — the "View agent →"
  links on category cards point nowhere real yet

## Session 5 — A2A protocol integration

**Added**

- `packages/a2a-server` — new package: `agentCard.ts` (one card, four
  skills, ERC-8004 cross-referenced via a custom extension rather than a
  second identity system), `skillRouter.ts` (resolves which skill a
  message means — explicit `metadata.skillId` first, keyword fallback
  otherwise), `rangebookExecutor.ts` (the one `AgentExecutor` for the
  whole card — this is the adapter layer; it calls the exact same
  `fulfillAuditJob` / `fulfillYieldJob` functions built in sessions 2–3,
  no new business logic), `server.ts` (Express + Agent Card + JSON-RPC/REST
  routes)
- `lib/agentSigner.ts` — the one genuinely new piece of state this layer
  needed: something has to hold the key that signs on the agent's behalf
  at request time. Explicitly marked testnet-only, not real custody
- `lib/sessionLookup.ts` — finds a wallet's active session for a category,
  re-verified against Keystore, same "cache is for speed, not trust" rule
  as the Permissions dashboard
- `lib/x402Guard.ts` — the payment gate, defaulted to pass-through
  (`A2A_REQUIRE_PAYMENT=false`) until `@altananetwork/x402-server`'s real
  Express export is confirmed against Altana's actual docs for that
  integration, rather than guessing an API shape the way an ABI shouldn't
  be guessed either
- `apps/api/src/a2a-server.ts` — second process within apps/api (`pnpm
  dev:a2a`), separate from the main Hono server, because a2a-js's HTTP
  glue is Express-specific and re-implementing JSON-RPC/REST bindings by
  hand to force it onto Hono isn't worth it

**Verified this session (not assumed)**

- `TaskState.AUTH_REQUIRED` really is the literal string `"auth-required"`
  in the v0.3 JS SDK — confirmed against the spec's own TypeScript enum
  and independently against the Python SDK's enum, not left as the
  flagged guess it was last turn

**Per-skill honesty, by design**

- `monitor-health-factor` — fully wired, reuses session 2's agent as-is
- `optimize-yield` — fully wired for a plain rate check (no session
  needed); the fuller "should I move" comparison needs a caller-supplied
  current venue, which most callers won't have
- `rebalance-liquidity`, `run-grid` — both return a clear `failed` status
  naming the exact gap (no position/grid-config tracking exists yet, on
  top of the chain-call stubs already flagged in sessions 2–3) rather than
  either faking a response or crashing the server

**Not started yet**

- Same network caveat as every session — nothing here has actually run,
  and `@a2a-js/sdk`'s types haven't been checked against real compiled
  output
- `InMemoryTaskStore` — task history doesn't survive a restart; fine for
  now, worth swapping for Supabase before it needs to persist
- Real key custody for `agentSigner.ts`
- LP position tracking (rebalancing) and grid configuration storage
  (grid trading) — both block their respective A2A skills and their
  original marketplace flows equally
- The real `@altananetwork/x402-server` Express wiring

## Session 6 — closing the two storage gaps, and a real research payoff

**Added**

- `rebalancing_positions`, `grid_configs` tables — the "whose position /
  whose grid is this" state that was missing, with matching types and
  shared lookups in `packages/db/src/lookups.ts` (used by both apps/api
  and packages/a2a-server, rather than duplicated in each)
- `POST/GET /positions/rebalancing`, `POST/GET /positions/grid` — the
  intake API for both

**Upgraded from stub to real — sourced this session, not assumed**

- `packages/agent-rebalancing/src/monitor.ts`'s `readPosition` now
  actually reads a live Infinity position. Confirmed against
  `pancakeswap/infinity-periphery`'s actual `CLPositionManager.sol` source
  on GitHub (`positions(tokenId)`'s real return signature) and against the
  deployed `CLPoolManager`'s verified ABI on BscScan
  (`0x32C59D556B16DB81DFc32525eFb3CB257f7e493d`) for `getSlot0`. One piece
  stays an explicit inference rather than a sourced fact: `computePoolId`
  assumes Solidity's `PoolIdLibrary.toId()` is `keccak256` of the
  abi-encoded `PoolKey` struct (the standard V4 pattern Infinity is
  documented as following) — flagged in the code as the first thing to
  check if a read comes back wrong, since I haven't seen
  `PoolIdLibrary.sol`'s actual source directly.
- `packages/agent-rebalancing/src/task.ts` — `fulfillRebalanceJob` now
  calls `readPosition` internally instead of taking pre-resolved state,
  matching how every other task handler owns its own read step
- `packages/a2a-server/src/rangebookExecutor.ts` — `rebalance-liquidity`
  and `run-grid` now genuinely attempt the work (tracked-position lookup →
  real read → real range check) instead of failing unconditionally. They
  still fail where a real gap remains — `rebalance()`'s write and
  `executeLevel`'s swap encoding — but that failure is now the actual
  edge of what's built, not a placeholder for the whole skill

**Still not implemented, unchanged**

- `rebalance()`'s write — `CLPositionManager.modifyLiquidities`'s action
  encoding (the Solidity-side "Planner" pattern) is a different, separate
  piece of work from the read that just got solved. Comment in
  `rebalance.ts` sharpened to be specific about this now that the read
  side isn't lumped in with it anymore.
- Grid Trading's swap execution — no new research done here this session;
  still deferred to the Altana PancakeSwap Trading skill as in session 3
- Same network caveat as every session — none of this has actually run,
  including the newly-confirmed contract calls

## Session 7 — Agent Advantage Report tooling

**Added**

- `ADVANTAGE_REPORT_METHODOLOGY.md` — the protocol for all 4 tasks (3
  required + Rebalancing as a bonus), written before any task is run:
  same-starting-state rules, a 3-axis 1–5 quality rubric so "quality"
  isn't a vibe, and exactly which of the four are actually runnable today
  vs. still blocked on a session 3/6 gap
- `advantage_report_tasks` schema — added quality-score fields (the brief
  requires quality alongside time and cost; the table didn't have
  anywhere to put it) and trading-specific fields (`win_rate_pct`,
  `risk_description`) for the separate track-record criterion
- `apps/api/src/routes/advantageReport.ts` — POST to create a task, PATCH
  to fill in either arm's results as they finish (rarely simultaneous),
  GET to list
- `apps/web/app/advantage-report/page.tsx` — renders whatever's actually
  in the table: a 3-task progress counter, a trading-task-recorded flag,
  side-by-side time/cost/quality per task. Linked from the main nav

**Deliberately not done**

- No sample or placeholder results anywhere in this session — the report
  page's empty state says exactly that, points at the methodology doc and
  the API, and shows nothing that could be mistaken for a real number.
  Task 1 (Grid Trading) and Task 4 (Rebalancing) are also explicitly
  marked not-yet-runnable in the methodology doc itself, tied to the exact
  gaps already flagged in sessions 3 and 6 — Tasks 2 and 3 (Yield,
  Health Factor) are ready to run for real today

**Not started yet**

- Actually running any of the 4 tasks — needs a real environment same as
  everything else
- A downloadable/exportable version of the report (the live page may be
  enough; a PDF export would be a small addition via the pdf skill later
  if wanted)

## Session 8 — consolidation, not new features

No new agent logic this session. Seven sessions of diffs is real friction
against actually running any of it for the first time, and `DEPLOY.md`
had drifted — still written as if only Health Factor Monitoring existed,
from session 2.

**Changed**

- `DEPLOY.md` — full rewrite covering all four agents, both processes
  (`pnpm dev` / `pnpm dev:a2a`), position/grid registration, and the
  Advantage Report — not just session 2's slice. Opens with a table of
  what actually works today vs. what's still blocked, so that's known
  before starting rather than discovered halfway through
- `README.md`'s status section — was still describing session 1;
  rewritten to the current, accurate picture in one place instead of
  requiring a read through seven changelog entries to reconstruct it

**Shipped as one full package, not a diff**

This session's zip is the complete current tree, not a diff to stack —
the point is exactly to remove the "apply 7 diffs correctly before you
can even start" step. Sessions from here can go back to diffs against
this as the new baseline.

**Still true, unchanged by this session**

Nothing here has actually run. Consolidating the paperwork doesn't
substitute for the first real `pnpm install` and `grantSession` call —
it just makes that first attempt have a fair chance of going smoothly
instead of fighting stale docs on top of everything else.

## Session 9 — Grid Trading's execution, the highest-leverage remaining gap

Per the session-7/8 review: this was the one piece blocking the required
trading task, the win-rate track record, and the last DeFi write path.

**Upgraded from stub to real**

- `packages/agent-grid-trading/src/execute.ts` — `executeLevel` now
  actually encodes and sends a Universal Router swap. Three different
  confidence levels here, kept distinct rather than presented as equally
  certain: command bytes (`V2_SWAP_EXACT_IN`, `PERMIT2_TRANSFER_FROM`)
  confirmed directly against `pancakeswap/infinity-universal-router`'s
  own `Commands.sol` on GitHub; `PERMIT2_TRANSFER_FROM`'s input shape
  confirmed against Uniswap's current `Dispatcher.sol`;
  `V2_SWAP_EXACT_IN`'s exact field list matches Uniswap's current
  `V2SwapRouter.sol` but wasn't independently re-checked against
  PancakeSwap's own fork, which could plausibly lag it
- `packages/agent-grid-trading/src/grid.ts` — added `computeAmountOutMin`,
  the slippage-guard math feeding the swap; takes decimals as required
  input rather than assuming 18, since BSC's BEP-20 USDT being 18
  decimals (unlike Ethereum's 6) is exactly the kind of assumption worth
  not hardcoding
- `packages/agent-grid-trading/src/task.ts` — `fulfillGridJob` is real
  end to end now: decide → size the guard → execute, no more stub in the
  middle
- `packages/a2a-server/src/rangebookExecutor.ts` — `run-grid` passes the
  wallet address and requires decimals explicitly via message metadata
  rather than guessing them

**One real, separate gap surfaced by finishing this — not solved here**

`PERMIT2_TRANSFER_FROM` only pulls tokens Permit2 already has an
allowance for. That's a one-time `approve()` from the wallet to Permit2 —
doesn't happen automatically, isn't part of the Altana session grant, and
isn't performed by this code. Needs to happen once, out of band, before
Grid Trading's first real swap.

**What this closes**

Grid Trading can now run for real, which means: the required trading
task for the Advantage Report is unblocked, the win-rate track record
TermiX weights becomes producible, and three of four agents are fully
real end to end (only Rebalancing's write remains stubbed).

## Session 10 — static audit, not new code

Prompted by a real question: nine sessions of edits, changed signatures,
and new cross-package imports is exactly the situation where something
gets missed. Checked rather than assumed.

**Found and fixed**

- `packages/altana` has imported `AgentCategory` from `@rangebook/db` in
  both `skills.ts` and `session.ts` since session 1, but never declared
  `@rangebook/db` as a dependency in its `package.json`. Would have
  failed to resolve under pnpm's default strict, non-hoisted dependency
  isolation on the first real `pnpm install` — the exact kind of thing
  that wastes an hour on a trivial cause.

**Checked and clean**

- Every cross-package import has a matching declared dependency (one
  exception, above, now fixed)
- Every call site of every function whose signature changed mid-project
  (`readPosition`, `fulfillRebalanceJob`, `executeLevel`,
  `fulfillGridJob`) matches its current definition — no stale callers
  left behind
- Every barrel export (`index.ts`) actually re-exports what other
  packages import from it
- Every package's `main`/`types` field resolves to a real file

**Still true**

This is a static read-through, not a real compile — it catches the class
of error most likely to have crept in (missing deps, stale call sites)
but isn't a substitute for an actual `tsc` run in a real environment.

## Session 11 — the missing activation flow, and a real architecture bug it exposed

**Added**

- `apps/web/app/agents/[category]/page.tsx` — the agent detail page that
  never existed; server component, resolves the category's contract
  allowlist and may/may-not boundaries server-side rather than
  duplicating them behind client env vars
- `apps/web/components/ActivateForm.tsx` — the actual Activate flow:
  connect wallet, category-specific inputs (position token ID for
  Rebalancing; pair/range/amount for Grid Trading, reusing the exact
  `buildEvenGrid` the agent itself runs), grant, record
- `apps/web/components/WalletButton.tsx`, `packages/ui/src/useWallet.ts` —
  real wallet connection, standard EIP-1193 pattern. Low-risk, well-
  established — doesn't carry the same verification flags as the DeFi-
  protocol-specific work elsewhere in this repo

**Fixed — a real architecture bug, not a stub**

`activateAgent` was being called from apps/api, server-side, with a
`userAdminSigner` from the request body. That can't work: a server can
never actually hold a user's admin key without becoming the custodian
this whole project's Altana track exists to avoid — there's no valid
value that JSON body field could ever contain. `grantSession` has to be
signed in the browser, where the wallet lives. Fixed by:
- `packages/altana/src/session.ts` — `activateAgent` now takes an
  already-constructed `altanaClient` rather than building one from
  server env vars, making it callable correctly from either side
- `apps/api/src/routes/sessions.ts` — `POST /sessions/activate` no longer
  performs a grant; it records one the browser already completed. Renamed
  its body shape to match — this was silently wrong from session 1 until
  building the real UI forced the question of who actually signs

**New, correctly scoped uncertainty**

Whether Altana's API key is safe to expose client-side (like a
publishable key) or needs to stay server-only isn't confirmed —
`NEXT_PUBLIC_ALTANA_API_KEY` is used as the deliberate, explicit choice
of "this one is public," separate from the server's key, rather than
quietly reusing the secret in the browser. Check Altana's docs for key
scoping before trusting this past testnet.

**Not done**

- The Rebalancing and Grid Trading category-specific forms assume
  deployment-level addresses (`NEXT_PUBLIC_CL_POSITION_MANAGER_ADDRESS`,
  `NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS`) are set — same "pull from the
  current skill file" rule as everywhere else
- No loading/success state polish beyond the basics
- Same network caveat as every session — none of this has run

## Session 12 — cross-session consistency checks, and a units bug from last session

Two targeted checks past the general audit style of session 10, plus one
real bug found in code from earlier the same day it was written.

**Checked, clean**

- The public address `apps/api` exposes during activation (what the
  browser includes in `grantSession`) and the address
  `packages/a2a-server` later derives to actually execute against that
  session — both read the exact same `AGENT_SIGNER_KEY_*` env vars
  through the same derivation. A mismatch here would have been silent
  and ugly: activation "succeeding" while every later execution attempt
  failed with an unauthorized-key error. It doesn't mismatch.
- The position/grid data shape written by `ActivateForm` and the shape
  read by `rangebookExecutor.ts` — consistent end to end.

**Found and fixed — introduced in session 11, caught the same day**

`ActivateForm`'s grid `amountPerLevel` field sent a plain human-scale
number with no decimals conversion, while every downstream consumer
(`executeLevel`, the same raw-smallest-unit pattern
`HEALTH_FACTOR_REPAY_STEP` uses) treats this value as an already-raw
integer. Someone entering "10" meaning 10 tokens would have silently
registered a grid trading 10 × 10⁻¹⁸ tokens per level — no error, just
a grid that does nothing. Fixed by adding a decimals input and
converting to raw units before the value ever leaves the form; the
schema and every reader downstream were already correct; only the form
was wrong.

**Type precision, tightened alongside the fix**

`grid_configs.amount_per_level` is now typed as a string end to end
(form → API → stored type), not a JS `number` — large raw-unit integers
can exceed `Number.MAX_SAFE_INTEGER`, and whether Supabase-js returns
large `numeric` columns as a string or a number isn't confirmed. Typing
it as a string doesn't quietly promise precision that hasn't been
verified.

## Session 13 — Rebalancing's write (partial), Permit2 for both categories

Picked two items off the "what's left unbuilt" list — the one with the
most research upside, and the one that was actually closeable outright.

**Rebalancing's write — substantially de-risked, not finished, and said
plainly rather than rounded up**

Researched `CLPositionManager.modifyLiquidities` against
`infinity-periphery`'s own `Actions.sol` and PancakeSwap's "Manage
liquidity" guide. Confirmed real: the action-byte values
(`CL_DECREASE_LIQUIDITY = 0x01`, `CL_MINT_POSITION = 0x02`), the overall
payload shape (`abi.encode(actions, params)`, same actions-bytes +
params-bytes[] structure as Universal Router), and `CL_MINT_POSITION`'s
full 8-field encoding — now real as `buildMintPositionAction`. Three
things are still genuinely open, named precisely in `rebalance.ts` rather
than left as one vague gap: `CL_DECREASE_LIQUIDITY`'s exact param tuple
(inferred, not sourced), how tokens freed by decreasing flow into minting
within one atomic payload (assumed analogous to Grid Trading's swap
pattern, not verified), and the settlement/`CLOSE_CURRENCY` sequence.
`rebalance()` itself still throws — this is a better-informed stub, and
calling it "real" would be the same mistake as an unverified ABI
presented with false confidence.

`monitor.ts`'s `readPosition` now also returns the pool's `poolKey`
(it was already fetching this internally and discarding it) — needed by
`rebalance()` to know which pool to mint into. `task.ts` and the A2A
executor updated to thread it through.

**Permit2 approval — closed for both categories that needed it**

`packages/ui/src/permit2.ts` — the two-step approval (`ERC20.approve` to
Permit2, then `Permit2.approve` to the actual spender) flagged as missing
since session 9. Wired into `ActivateForm` for both Grid Trading
(approves the Universal Router) and Rebalancing (approves
CLPositionManager — confirmed by the same PancakeSwap guide as needing
this too, not assumed). Always sends both transactions rather than
checking existing allowance first — simpler and idempotent, at the cost
of an occasional redundant transaction.

**A bug caught while wiring it, from the same edit that introduced it**

First pass at Rebalancing's Permit2 step reused `baseToken`/`quoteToken`
state — which belongs to the Grid Trading form, not Rebalancing, which
only collects a position ID. Rebalancing doesn't know its pool's tokens
until read. Fixed by calling `readPosition` (a plain public read, no
session needed) before requesting approval, using the real
`poolKey.currency0`/`currency1` instead of unrelated form state.

**Not done**

- The three named gaps in `rebalance()`
- Venus health factor, PancakeSwap LP fee APR, Lista APR — still zero
  code, per the "what's unbuilt" review
- x402's real Express wiring, ERC-8183 buyer side, real key custody,
  mainnet
- Same network caveat as every session — none of this has run, including
  whether Permit2 is really deployed at the assumed address on BSC
