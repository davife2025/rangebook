# Agent brief — Rebalancing

Paste into Cursor once `bag skills install` has run, per Agent Studio's
documented workflow.

---

Build an agent called **Rangebook Rebalancer** that:

- Watches a PancakeSwap Infinity CLAMM liquidity position (BNB Chain) using
  the PancakeSwap Liquidity skill.
- If the position moves out of range, removes liquidity and re-adds it
  centered on the current price, at the same range width, using only what
  the agent's active session allows.
- Returns a report: range status before, action taken, new range,
  transaction hash if it acted.
- Exposes itself as an ERC-8183 task: "Rebalance this LP position."
- Checks on a 10-minute interval for any wallet with an active session.

The decision logic (in range or not, what the new range should be) already
exists at `packages/agent-rebalancing/src/monitor.ts` and is correct as
written. The actual Infinity CLPositionManager read/write calls are NOT
written yet — build those against `pancakeswap/infinity-periphery` on
GitHub or the current PancakeSwap Liquidity skill file, not from memory or
from an old V3 tutorial.
