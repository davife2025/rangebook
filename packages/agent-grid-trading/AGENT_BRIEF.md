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
`packages/agent-grid-trading/src/grid.ts`. The swap execution is real as
of this session too — command bytes confirmed against PancakeSwap's own
`infinity-universal-router` source. Two things to check before this runs
for real, not assume are handled: the wallet needs a one-time `approve()`
to Permit2 before `PERMIT2_TRANSFER_FROM` can pull anything, and
`V2_SWAP_EXACT_IN`'s exact field count should be checked against
PancakeSwap's own `V2SwapRouter.sol` rather than trusted purely on
Uniswap's — see the comment on `executeLevel` for the full reasoning.
