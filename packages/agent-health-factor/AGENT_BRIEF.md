# Agent brief — Health Factor Monitoring

Per BNB Agent Studio's documented flow: `bag skills install` first (teaches
Cursor/Claude Code the Studio primitives), then paste this in and let it
scaffold and deploy.

---

Build an agent called **Rangebook Health Factor Monitor** that:

- On request, checks a given wallet's health factor on Aave V3 (BNB Chain)
  using the Aave V3 Lending skill.
- If the health factor is below 1.15, repays enough debt to move it back
  toward a safer level, using only what the agent's active session allows —
  never more than its spend cap, never a contract outside its allowlist.
- Returns a short report: health factor before and after, whether it acted,
  and the transaction hash if it did.
- Exposes itself as an ERC-8183 task so it can be hired on demand — the
  task text will look like "Audit wallet 0x…'s Aave position and recommend
  an action."
- Also runs this check on a 5-minute interval for any wallet with an active
  session, not just on-demand.

Wallet: TWAK (default). LLM: default. Cloud: AWS AgentCore (default).

The actual monitoring/defending logic already exists in this repo at
`packages/agent-health-factor/src/` (`monitor.ts`, `defend.ts`, `task.ts`)
— point the scaffolded agent at `fulfillAuditJob` from `task.ts` as its
core handler rather than re-deriving the logic from scratch.
