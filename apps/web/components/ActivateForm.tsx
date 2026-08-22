"use client";

import { useState } from "react";
import { AltanaClient } from "@altananetwork/sdk";
import { activateAgent } from "@rangebook/altana";
import { buildEvenGrid } from "@rangebook/agent-grid-trading";
import { useWallet, Button, Card, Bound, CountdownBound, ensurePermit2Approval } from "@rangebook/ui";
import type { AgentCategory } from "@rangebook/db";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface ActivateFormProps {
  category: AgentCategory;
  agentId: string;
  sessionSignerAddress: `0x${string}` | null;
  contracts: `0x${string}`[];
  defaultSpend: { limit: string; token: string; period: string };
  defaultExpirySeconds: number;
  positionManagerAddress?: `0x${string}`;
  universalRouterAddress?: `0x${string}`;
}

type Status = "idle" | "activating" | "done" | "error";

export function ActivateForm(props: ActivateFormProps) {
  const wallet = useWallet("testnet");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sessionKeyAddress: `0x${string}`; expiresAt: Date } | null>(null);

  // Category-specific inputs — only the categories that need extra config render them.
  const [positionTokenId, setPositionTokenId] = useState("");
  const [baseToken, setBaseToken] = useState("");
  const [quoteToken, setQuoteToken] = useState("");
  const [floor, setFloor] = useState("");
  const [ceiling, setCeiling] = useState("");
  const [levelCount, setLevelCount] = useState("6");
  const [amountPerLevel, setAmountPerLevel] = useState("");
  const [amountDecimals, setAmountDecimals] = useState("18");

  async function handleActivate() {
    if (!wallet.address || !wallet.client) return;

    if (!props.sessionSignerAddress) {
      setError("This agent's session signer isn't configured (AGENT_SIGNER_KEY_* missing server-side) — see .env.example.");
      setStatus("error");
      return;
    }
    if (props.contracts.length === 0) {
      setError("This category's contract allowlist isn't configured yet — pull it from the current skill file and set it in .env.");
      setStatus("error");
      return;
    }

    setStatus("activating");
    setError(null);

    try {
      if (props.category === "rebalancing") {
        if (!positionTokenId) throw new Error("Enter your position's token ID.");
        if (!props.positionManagerAddress) throw new Error("NEXT_PUBLIC_CL_POSITION_MANAGER_ADDRESS isn't set.");
        // Rebalancing only collects a tokenId — the pool's actual tokens
        // aren't known until read. readPosition is a plain public read
        // (no session needed yet), safe to call here before Permit2
        // approval or the session grant.
        const { readPosition } = await import("@rangebook/agent-rebalancing");
        const position = await readPosition(BigInt(positionTokenId), props.positionManagerAddress);
        // CLPositionManager pulls tokens through Permit2 too, same as
        // Universal Router — confirmed in the same PancakeSwap guide the
        // rebalance() research came from this session.
        for (const token of [position.poolKey.currency0, position.poolKey.currency1]) {
          await ensurePermit2Approval({
            walletClient: wallet.client,
            account: wallet.address,
            token,
            spender: props.positionManagerAddress,
          });
        }
        const res = await fetch(`${API_URL}/positions/rebalancing`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agentId: props.agentId,
            walletAddress: wallet.address,
            positionTokenId,
            positionManagerAddress: props.positionManagerAddress,
          }),
        });
        if (!res.ok) throw new Error("Couldn't register the tracked position.");
      }

      if (props.category === "grid_trading") {
        if (!baseToken || !quoteToken || !floor || !ceiling || !amountPerLevel) {
          throw new Error("Fill in the pair, range, and amount per level.");
        }
        if (!props.universalRouterAddress) throw new Error("NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS isn't set.");
        // The one-time approval flagged since session 9 — without this,
        // the first real swap would revert on PERMIT2_TRANSFER_FROM.
        await ensurePermit2Approval({
          walletClient: wallet.client,
          account: wallet.address,
          token: baseToken as `0x${string}`,
          spender: props.universalRouterAddress,
        });
        await ensurePermit2Approval({
          walletClient: wallet.client,
          account: wallet.address,
          token: quoteToken as `0x${string}`,
          spender: props.universalRouterAddress,
        });
        // Same grid math the agent itself runs — not reimplemented here.
        const config = buildEvenGrid(Number(floor), Number(ceiling), Number(levelCount), {
          base: baseToken as `0x${string}`,
          quote: quoteToken as `0x${string}`,
        });
        // Stored as a raw smallest-unit integer, same as everywhere else
        // this repo handles token amounts (see HEALTH_FACTOR_REPAY_STEP in
        // packages/agent-yield-optimisation/src/task.ts for the same
        // pattern) — the form collects a human-scale number, this is
        // where that gets converted, not left for whatever reads it later
        // to guess.
        const amountPerLevelRaw = BigInt(Math.floor(Number(amountPerLevel) * 10 ** Number(amountDecimals)));
        const res = await fetch(`${API_URL}/positions/grid`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agentId: props.agentId,
            walletAddress: wallet.address,
            baseToken,
            quoteToken,
            universalRouterAddress: props.universalRouterAddress,
            levels: config.levels,
            amountPerLevel: amountPerLevelRaw.toString(),
          }),
        });
        if (!res.ok) throw new Error("Couldn't register the grid.");
      }

      // The actual grant — signed by the connected wallet, client-side,
      // because that's the only place the user's admin key exists.
      //
      // UNVERIFIED: whether Altana's API key is safe to expose in the
      // browser (a publishable-style key) or needs to stay server-only
      // (a secret-style key) hasn't been confirmed against the real SDK.
      // NEXT_PUBLIC_ALTANA_API_KEY is used here as the explicit,
      // deliberate choice of "this one is meant to be public" — check
      // Altana's docs for key scoping before reusing the server's
      // ALTANA_API_KEY value here.
      const altana = new AltanaClient({
        apiKey: process.env.NEXT_PUBLIC_ALTANA_API_KEY!,
        network: process.env.NEXT_PUBLIC_ALTANA_ENV === "mainnet" ? "bnb" : "bnb-testnet",
      });

      const grant = await activateAgent({
        category: props.category,
        userWalletAddress: wallet.address,
        userAdminSigner: wallet.client,
        agentSessionSigner: props.sessionSignerAddress,
        altanaClient: altana,
      });

      // Record the already-completed grant. This call never signs
      // anything — it's just writing down what the wallet just did.
      await fetch(`${API_URL}/sessions/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: props.agentId,
          userWalletAddress: wallet.address,
          sessionKeyAddress: grant.sessionKeyAddress,
          expiresAt: grant.expiresAt.toISOString(),
          keystoreTxHash: grant.keystoreTxHash,
        }),
      });

      setResult({ sessionKeyAddress: grant.sessionKeyAddress, expiresAt: grant.expiresAt });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
      setStatus("error");
    }
  }

  if (status === "done" && result) {
    return (
      <Card className="mt-8">
        <p className="mb-4 text-sm font-medium" style={{ color: "var(--color-signal)" }}>
          Activated.
        </p>
        <div className="flex flex-col gap-4">
          <Bound kind="cap" value={`${props.defaultSpend.limit} ${props.defaultSpend.token}/${props.defaultSpend.period}`} />
          <CountdownBound expiresAt={result.expiresAt} />
        </div>
        <p className="mt-4 text-xs" style={{ color: "var(--color-mist)" }}>
          Manage or revoke this anytime from{" "}
          <a href="/permissions" className="underline">
            Permissions
          </a>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <p className="mb-4 text-xs font-semibold tracking-[0.1em]" style={{ color: "var(--color-mist)" }}>
        ACTIVATE
      </p>

      {!wallet.address ? (
        <Button variant="primary" onClick={wallet.connect} disabled={wallet.connecting}>
          {wallet.connecting ? "Connecting…" : "Connect wallet"}
        </Button>
      ) : (
        <>
          <p className="mb-4 text-xs" style={{ fontFamily: "var(--font-data)", color: "var(--color-mist)" }}>
            {wallet.address}
          </p>

          {props.category === "rebalancing" && (
            <input
              value={positionTokenId}
              onChange={(e) => setPositionTokenId(e.target.value)}
              placeholder="Position token ID"
              className="mb-3 w-full rounded-md px-3 py-2 text-sm"
              style={inputStyle}
            />
          )}

          {props.category === "grid_trading" && (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <input value={baseToken} onChange={(e) => setBaseToken(e.target.value)} placeholder="Base token 0x…" style={inputStyle} className="rounded-md px-3 py-2 text-sm" />
              <input value={quoteToken} onChange={(e) => setQuoteToken(e.target.value)} placeholder="Quote token 0x…" style={inputStyle} className="rounded-md px-3 py-2 text-sm" />
              <input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Floor price" style={inputStyle} className="rounded-md px-3 py-2 text-sm" />
              <input value={ceiling} onChange={(e) => setCeiling(e.target.value)} placeholder="Ceiling price" style={inputStyle} className="rounded-md px-3 py-2 text-sm" />
              <input value={levelCount} onChange={(e) => setLevelCount(e.target.value)} placeholder="Levels" style={inputStyle} className="rounded-md px-3 py-2 text-sm" />
              <input value={amountPerLevel} onChange={(e) => setAmountPerLevel(e.target.value)} placeholder="Amount per level" style={inputStyle} className="rounded-md px-3 py-2 text-sm" />
              <input value={amountDecimals} onChange={(e) => setAmountDecimals(e.target.value)} placeholder="Decimals (18 for most BEP-20)" style={inputStyle} className="col-span-2 rounded-md px-3 py-2 text-sm" />
            </div>
          )}

          <Button variant="primary" onClick={handleActivate} disabled={status === "activating"}>
            {status === "activating" ? "Activating…" : "Activate"}
          </Button>
        </>
      )}

      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--color-negative)" }}>
          {error}
        </p>
      )}
    </Card>
  );
}

const inputStyle = {
  background: "var(--color-slate)",
  border: "1px solid var(--color-rule)",
  color: "var(--color-paper)",
  fontFamily: "var(--font-data)",
};
