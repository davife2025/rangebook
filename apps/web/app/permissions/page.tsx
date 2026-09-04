"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Button, Bound, CountdownBound, useWallet } from "@rangebook/ui";

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
  const wallet = useWallet("testnet");
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async (walletAddress: string) => {
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
    if (wallet.address) load(wallet.address);
  }, [wallet.address, load]);

  async function handleRevoke(sessionKeyAddress: string, id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionKeyAddress}/revoke`, { method: "POST" });
      if (!res.ok) throw new Error(`Revoke failed: ${res.status}`);
      if (wallet.address) await load(wallet.address);
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

      {!wallet.address ? (
        <Button variant="primary" className="mt-6" onClick={wallet.connect} disabled={wallet.connecting}>
          {wallet.connecting ? "Connecting…" : "Connect wallet"}
        </Button>
      ) : (
        <p className="mt-6 text-xs" style={{ fontFamily: "var(--font-data)", color: "var(--color-mist)" }}>
          {wallet.address}
        </p>
      )}

      {(error || wallet.error) && (
        <p className="mt-4 text-sm" style={{ color: "var(--color-negative)" }}>
          {error ?? wallet.error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4">
        {wallet.address && sessions === null && !error && (
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
