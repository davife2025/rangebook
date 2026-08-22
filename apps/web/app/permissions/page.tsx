"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Button, Bound, CountdownBound } from "@rangebook/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface SessionRow {
  id: string;
  session_key_address: string;
  spend_limit: number | null;
  spend_token: string | null;
  spend_period: string | null;
  expires_at: string;
  agents: { name: string; category: string } | null;
}

export default function PermissionsPage() {
  // Wallet connection isn't built yet — this is a deliberate stand-in for
  // it, not a design decision. Swap for a real Altana/wagmi connect flow
  // before this page is trusted for anything beyond local testing.
  const [wallet, setWallet] = useState("");
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async (walletAddress: string) => {
    if (!walletAddress) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/sessions?wallet=${walletAddress}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const body = await res.json();
      setSessions(body.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
      setSessions(null);
    }
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem("rb-wallet") : null;
    if (saved) {
      setWallet(saved);
      load(saved);
    }
  }, [load]);

  async function handleRevoke(sessionKeyAddress: string, id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionKeyAddress}/revoke`, { method: "POST" });
      if (!res.ok) throw new Error(`Revoke failed: ${res.status}`);
      await load(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        Permissions
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--color-mist)" }}>
        Every agent you&apos;ve activated, and exactly what it&apos;s allowed to do.
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          window.sessionStorage.setItem("rb-wallet", wallet);
          load(wallet);
        }}
      >
        <input
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder="0x… wallet address"
          className="flex-1 rounded-md px-3 py-2 text-sm"
          style={{
            background: "var(--color-slate)",
            border: "1px solid var(--color-rule)",
            color: "var(--color-paper)",
            fontFamily: "var(--font-data)",
          }}
        />
        <Button type="submit" variant="ghost">
          Load
        </Button>
      </form>

      {error && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-negative)" }}>
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4">
        {sessions === null && !error && wallet && (
          <p className="text-sm" style={{ color: "var(--color-mist)" }}>
            Loading…
          </p>
        )}

        {sessions?.length === 0 && (
          <p className="text-sm" style={{ color: "var(--color-mist)" }}>
            No active agents for this wallet.
          </p>
        )}

        {sessions?.map((session) => (
          <Card key={session.id} className="flex items-center justify-between gap-6">
            <div className="flex flex-col gap-3">
              <p className="font-medium">
                {session.agents?.name ?? "Unknown agent"}
                <span className="ml-2 text-xs" style={{ color: "var(--color-mist)" }}>
                  {session.session_key_address.slice(0, 10)}…
                </span>
              </p>
              <div className="flex gap-6">
                {session.spend_limit && (
                  <Bound kind="cap" value={`${session.spend_limit} ${session.spend_token}/${session.spend_period}`} />
                )}
                <CountdownBound expiresAt={new Date(session.expires_at)} />
              </div>
            </div>
            <Button
              variant="danger"
              disabled={revokingId === session.id}
              onClick={() => handleRevoke(session.session_key_address, session.id)}
            >
              {revokingId === session.id ? "Revoking…" : "Revoke"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
