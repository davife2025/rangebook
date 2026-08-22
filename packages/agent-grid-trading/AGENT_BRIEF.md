# Agent brief — Grid Trading

Paste into Cursor once `bag skills install` has run.

---

Build an agent called **Rangebook Grid Trader** that:

- Holds a grid of buy/sell price levels for one pair (BNB Chain, via the
  PancakeSwap Trading skill) — no native grid primitive exists on the DEX,
  so this state lives with the agent.
- On each check, compares the current price against the grid and executes
  any newly-crossed level, using only what the agent's active session
  allows.
- Returns a report: levels triggered, transaction hashes, price checked
  against.
- Exposes itself as an ERC-8183 task: "Check and run this grid."
- Checks on a 1-minute interval for any wallet with an active session —
  tighter than the other three agents, since grid trading is the one
  category where latency matters.

The grid state machine already exists and is correct at
`packages/agent-grid-trading/src/grid.ts`. The actual swap execution is
NOT written yet — build it via the Altana PancakeSwap Trading skill
(Universal Router command encoding, done and fork-tested there), not by
hand-rolling Universal Router calls from memory.
