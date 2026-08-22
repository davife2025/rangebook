# Agent Advantage Report — methodology

TermiX's rubric requires this report to show, with real numbers: at least
3 real tasks, run both with an agent hired through Rangebook and without,
reporting time, cost, and output quality for each, with actual outputs
attached. At least one task must be trading, stock, or security — and
trading tasks specifically need a real track record (win rate, the
window, the risk taken).

**Nothing in this file is a result.** It's the protocol for producing
results that hold up — written before any task is run, so the method
isn't shaped to fit whichever number comes out. Fill in
`advantage_report_tasks` (schema in `packages/db/src/schema.sql`, API in
`apps/api/src/routes/advantageReport.ts`) with real data collected this
way; the `/advantage-report` page renders whatever's actually there and
nothing else.

## The quality rubric

"Output quality" is the one metric that isn't a number by default, so
score it the same way every time: **1–5 on each of three axes**, recorded
in `quality_rubric_notes` alongside the score.

| Axis | 1 | 3 | 5 |
|---|---|---|---|
| Accuracy | Materially wrong | Right direction, imprecise | Matches ground truth |
| Execution fidelity | Errored or went outside bounds | Completed with minor deviation | Completed exactly as specified |
| Completeness | Partial / abandoned | Core task done, edges missed | Fully done, nothing left manual |

Report the average of the three as `with_agent_quality_score` /
`without_agent_quality_score`. A task where the agent legitimately
declines to act (e.g. health factor already safe, no action needed) is
still gradeable — accuracy and completeness both apply to "correctly did
nothing."

## General rules, all four tasks

- **Same starting state for both arms.** Same capital, same position, same
  market conditions as close to simultaneous as the task allows. A task
  run "with agent" on Monday and "without" on Thursday isn't a comparison,
  it's two different markets.
- **Time means wall-clock human time**, not agent runtime. An agent
  running unattended for 3 hours costs the person 0 minutes; the "without"
  arm's clock only runs while a person is actually watching or acting.
- **Cost means real cost** — gas paid, plus, for the manual arm, a labor
  cost at a stated hourly rate (pick one, state it in `notes`, use it
  consistently across tasks).
- **Attach the real output.** A screenshot of the tx on BscScan, the
  agent's actual JSON deliverable, a screen recording of the manual arm —
  linked via `*_output_url`, not just described.

## Task 1 — Grid Trading (the required trading task)

Also the source of the win-rate track record TermiX weights separately.

- **Pair & window:** a liquid pair (BNB/USDT is the obvious default), 72
  hours — long enough for several grid cycles, short enough to fit inside
  the build window.
- **Setup:** identical grid definition for both arms — same floor,
  ceiling, level count, same notional per level (`buildEvenGrid` in
  `packages/agent-grid-trading/src/grid.ts` generates this once; reuse the
  same output for both arms rather than defining it twice).
- **With agent:** activate Grid Trading with that config, let it run
  unattended for the full window.
- **Without agent:** a person watches the same price feed and manually
  places/cancels the same levels by hand for the same window.
- **Report, beyond the standard fields:** `win_rate_pct` (share of
  completed buy→sell cycles that were net profitable after gas),
  `risk_description` (max capital at risk at any point — the sum of
  unfilled buy levels' notional), `window_start`/`window_end` set to the
  actual 72 hours used.
- **Status:** blocked on nothing — Grid Trading's *read* side (deciding
  which levels triggered) is real as of session 3. The agent's swap
  *execution* still depends on the Universal Router encoding flagged in
  `packages/agent-grid-trading/src/execute.ts`; that needs to land before
  the "with agent" arm can run unattended for real.

## Task 2 — Yield Optimisation

- **Capital & window:** same notional (e.g. $1,000 equivalent) starting in
  the same venue for both arms, 24–48 hours.
- **With agent:** the agent checks real Aave V3 / Venus rates
  (`packages/agent-yield-optimisation/src/rates.ts` — both real reads as
  of session 3) and reports or moves per its threshold.
- **Without agent:** a person checks the same two protocols' current
  rates by hand and decides.
- **Report:** resulting APR achieved by each arm, gas cost, and whether
  the venue found matches the actual best rate at that moment (a
  correctness check, not just a speed one).
- **Status:** ready to run — nothing blocking this one.

## Task 3 — Health Factor Monitoring

Mirrors Altana's own example task almost exactly, which is a good sign
this is the easiest one to make legible to an outside evaluator.

- **Setup:** a real (or testnet) leveraged position pushed toward risk —
  either a genuine price move or a deliberate extra borrow — to a known
  starting health factor below the safe threshold, mirrored identically
  for both arms.
- **With agent:** let the monitoring loop (or an on-demand audit job,
  `fulfillAuditJob`) catch and defend it.
- **Without agent:** a person watches the same position and intervenes
  manually.
- **Report:** reaction time from breach to a landed defensive transaction,
  whether liquidation was avoided, cost of the action taken.
- **Status:** ready to run — this agent is the most complete of the four.

## Task 4 — Rebalancing (bonus; not required to hit the minimum of 3)

- Same shape as the others: an LP position pushed out of range, mirrored
  for both arms, time-in-range % and fees saved as the headline numbers.
- **Status:** blocked. Reading a position is real as of session 6; the
  actual rebalance *write* (`packages/agent-rebalancing/src/rebalance.ts`)
  is still a documented stub. Run this one once that closes — tasks 1–3
  already satisfy the "at least 3, one trading" requirement without it.

## Filling in real numbers

Once a task is actually run:

```bash
curl -X POST http://localhost:8787/advantage-report/tasks \
  -H "content-type: application/json" \
  -d '{ "agentId": "...", "taskTitle": "...", ... }'
```

or `PATCH` an existing row by id to fill in the second arm once it's done.
The `/advantage-report` page reads directly from this table — there's
nothing to regenerate or keep in sync separately.
