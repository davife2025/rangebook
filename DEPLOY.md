# Deploying Rangebook

Nothing below can run from the chat sandbox this was built in — no
network access there. This needs Claude Code, or your own machine.

## Read this part first

What a first real run can and can't do today, so there are no surprises
halfway through:

| Works for real | Still blocked |
|---|---|
| Health Factor Monitoring, start to finish, including the defensive repay | Rebalancing's actual rebalance write (`packages/agent-rebalancing/src/rebalance.ts`) — reading a position is real, writing one isn't |
| Yield Optimisation's rate comparison (Aave + Venus) | Grid Trading's swap execution (`packages/agent-grid-trading/src/execute.ts`) — deciding *when* to trade is real, executing isn't |
| Rebalancing's position read + range check (`packages/agent-rebalancing/src/monitor.ts`) | The x402 payment gate on the A2A endpoint (`packages/a2a-server/src/lib/x402Guard.ts`) — currently a pass-through |
| The marketplace, Permissions dashboard, Advantage Report page | Real wallet connection — Permissions still takes a pasted address |
| The A2A endpoint (Agent Card + task routing) for all 4 skills | Real key custody (`packages/a2a-server/src/lib/agentSigner.ts`) — env-var keys, testnet only |
| 8004scan + live-rate data on marketplace cards | Mainnet deployment — everything below targets testnet |

Two of the four agents are fully real. Two are real up to a specific,
named line and then honestly stop. That's enough to prove the pattern
end to end and to run 2 of the 3 required Agent Advantage Report tasks —
see the table's left column before assuming something's broken.

## 1. Prerequisites

- Testnet BNB: https://testnet.bnbchain.org/faucet-smart
- A Supabase project
- Node 20+, pnpm

## 2. Install the Agent Studio CLI

```bash
npm install -g @bnbagent/studio-cli
bag skills install    # teaches Cursor/Claude Code the Studio primitives
```

## 3. Install dependencies and configure

```bash
pnpm install
cp .env.example .env
```

Fill in `.env` — the file is organized by which app/package needs what.
The two blocks worth reading closely before continuing:

- **Session contract allowlists** (`ALTANA_ALLOWLIST_*`,
  `AAVE_V3_POOL_ADDRESS`, `AAVE_V3_DATA_PROVIDER_ADDRESS`) — pull every one
  of these from the current skill file at skills.altana.network, not from
  memory or an old tutorial. This matters most for anything touching
  PancakeSwap, since Infinity superseded the old V2/V3 router.
- **Agent signer keys** (`AGENT_SIGNER_KEY_*`) — testnet keys only, per
  the warning in `agentSigner.ts`. Don't reuse these anywhere real funds
  touch.

## 4. Push the schema

```bash
supabase db push   # or paste packages/db/src/schema.sql into the SQL editor
```

## 5. Deploy the four agents

Each has a brief at `packages/agent-<name>/AGENT_BRIEF.md`, written for
Cursor per Agent Studio's documented workflow. For each:

1. Open this repo in Cursor, paste the brief in, let it scaffold and
   deploy. Point it at the existing `task.ts` in that package for the
   real logic rather than re-deriving it.
2. Ask Cursor to deploy and verify — this registers the agent's ERC-8004
   identity and brings its ERC-8183 task interface up automatically.
3. Copy the resulting agent ID into the matching `AGENT_STUDIO_*_ID` env
   var, and insert a row for it into the `agents` table (status `testnet`
   or `live`).

Do Health Factor Monitoring first — it's the most complete, and doubles
as a sanity check for the whole pattern before repeating it three more
times.

## 6. Start everything

```bash
pnpm dev        # apps/web on :3000, apps/api on :8787
pnpm dev:a2a    # the A2A/Express server on :8788, separate process
```

## 7. Sanity-check reads before touching sessions

```bash
pnpm --filter @rangebook/agent-health-factor check-once 0xYourTestnetWallet
```

Confirms `checkAaveHealthFactor` returns a sane number with nothing else
involved.

## 8. First real session

Activate Health Factor Monitoring from the marketplace against your
testnet wallet. This is the first real `grantSession` call — confirm it
in your wallet, then check the resulting transaction on the Altana
explorer and on BscScan testnet. **This transaction is the actual proof
the Altana track asks for.**

Then confirm the defend path: borrow against thin collateral on Aave V3
testnet until the health factor drops under 1.15, wait for the 5-minute
check (or call `fulfillAuditJob` directly), and confirm the repay lands
inside the session's spend cap.

## 9. Register a tracked position and a grid

Rebalancing and Grid Trading both need to be told what to manage before
they can do anything — see session 6 and 7's reasoning in `CHANGELOG.md`
if the "why" isn't obvious:

```bash
curl -X POST http://localhost:8787/positions/rebalancing \
  -H "content-type: application/json" \
  -d '{"agentId":"...", "walletAddress":"0x...", "positionTokenId":"...", "positionManagerAddress":"0x..."}'

curl -X POST http://localhost:8787/positions/grid \
  -H "content-type: application/json" \
  -d '{"agentId":"...", "walletAddress":"0x...", "baseToken":"0x...", "quoteToken":"0x...", "universalRouterAddress":"0x...", "levels":[...], "amountPerLevel":10}'
```

Once a position is registered, Rebalancing's read/range-check runs for
real — confirm it reports `in_range` or `out_of_range_*` correctly before
expecting anything past that (the actual rebalance is the piece that
still throws, on purpose).

## 10. Confirm the A2A endpoint

```bash
curl http://localhost:8788/.well-known/agent-card.json
```

Should return the four-skill Agent Card. Then send a real task:

```bash
curl -X POST http://localhost:8788/jsonrpc \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"kind":"message","messageId":"m1","role":"user","parts":[{"kind":"text","text":"Audit wallet 0xYourTestnetWallet health factor"}]}}}'
```

Should route to Health Factor Monitoring and return a real result.

## 11. Run the two ready Advantage Report tasks

Full protocol in `ADVANTAGE_REPORT_METHODOLOGY.md`. Yield Optimisation and
Health Factor Monitoring are ready today; Grid Trading and Rebalancing
are blocked on the same gaps as steps above. Record results via:

```bash
curl -X POST http://localhost:8787/advantage-report/tasks -H "content-type: application/json" -d '{...}'
curl -X PATCH http://localhost:8787/advantage-report/tasks/<id> -H "content-type: application/json" -d '{...}'
```

`/advantage-report` on the marketplace renders whatever's actually
recorded — nothing to regenerate separately.
