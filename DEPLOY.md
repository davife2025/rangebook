# Deploying the Health Factor Monitoring agent

Nothing below can run from the chat sandbox — no network access there.
This needs Claude Code, or your own machine.

## 1. Testnet funds

Get testnet BNB: https://testnet.bnbchain.org/faucet-smart

## 2. Install the Agent Studio CLI

```bash
npm install -g @bnbagent/studio-cli
bag skills install    # teaches Cursor/Claude Code the Studio primitives
```

## 3. Scaffold the agent

Open this repo in Cursor. Paste the brief from
`packages/agent-health-factor/AGENT_BRIEF.md` into the chat and let it
scaffold against the CLI. Point it at `fulfillAuditJob` in
`packages/agent-health-factor/src/task.ts` for the actual logic rather than
re-deriving it.

## 4. Deploy

Ask Cursor to deploy and verify the agent is live. This registers the
agent's ERC-8004 identity and brings its ERC-8183 task interface up on AWS
AgentCore.

→ Copy the resulting agent ID into `AGENT_STUDIO_HEALTH_ID` in `.env`.

## 5. Wire dependencies and Altana

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase project
- `ALTANA_API_KEY`, `ALTANA_ENV=testnet`
- `AAVE_V3_POOL_ADDRESS` and `ALTANA_ALLOWLIST_LENDING_DEFENSE` — pull the
  current Aave V3 Pool address for BSC from the Aave V3 Lending skill file
  at skills.altana.network, don't reuse an address from an old tutorial

## 6. Push the schema

```bash
supabase db push   # or paste packages/db/src/schema.sql into the SQL editor
```

Then insert one row into `agents` for Health Factor Monitoring, using the
`erc8004_agent_id` from step 4.

## 7. Sanity-check the read path alone

```bash
pnpm --filter @rangebook/agent-health-factor check-once 0xYourTestnetWallet
```

This exercises `checkAaveHealthFactor` with nothing else involved — confirm
it returns a sane health factor before touching sessions at all.

## 8. First real session

```bash
pnpm dev   # apps/web on :3000, apps/api on :8787
```

Activate Health Factor Monitoring from the marketplace against your
testnet wallet. This is the first real `grantSession` call — confirm it in
your wallet, then check the resulting transaction on the Altana explorer
and on BscScan testnet. This transaction is the actual proof the Altana
track asks for.

## 9. Confirm the defend path

Borrow against thin collateral on Aave V3 testnet until the health factor
drops under 1.15, then either wait for the 5-minute check or call
`fulfillAuditJob` directly. Confirm the repay transaction lands inside the
session's spend cap and that the health factor recovers.

## 10. This is also Agent Advantage Report task #1

Audit a real testnet wallet with the agent (time it, note the tx hash),
then do the same audit by hand. Record both in `advantage_report_tasks` —
this is the Health Factor Monitoring row in the required report.
