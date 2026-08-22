# Agent brief — Yield Optimisation

Paste into Cursor once `bag skills install` has run.

---

Build an agent called **Rangebook Yield Router** that:

- Compares real supply APR across Aave V3 and Venus (BNB Chain) for a
  given asset, using the Aave V3 Lending and Venus Lending skills.
- If a venue beats the current one by more than a configurable threshold,
  withdraws and re-supplies in a single atomic call — never leaving funds
  uninvested between the two steps — using only what the agent's active
  session allows.
- Returns a report: APR at each venue checked, whether it moved, and the
  transaction hash if so.
- Exposes itself as an ERC-8183 task: "Find and move to the best real
  yield."
- Checks on a 30-minute interval for any wallet with an active session.

Real rate reads and the routing decision already exist at
`packages/agent-yield-optimisation/src/rates.ts` and `compare.ts`. Lista
and PancakeSwap LP fee APR are NOT wired in yet — both need a data source
beyond a single contract read (see the comments in rates.ts for why) —
extend to them once that source exists rather than approximating. The
actual withdraw/supply calldata per venue also isn't built — encode it
against the Aave V3 Lending / Venus Lending skill files, not from memory.
