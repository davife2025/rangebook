"use client";

import { useEffect, useState } from "react";

type BoundKind = "may" | "cap" | "until";

const LABEL: Record<BoundKind, string> = {
  may: "AGENT MAY",
  cap: "UP TO",
  until: "UNTIL",
};

export interface BoundProps {
  kind: BoundKind;
  value: string;
  live?: boolean;
  className?: string;
}

/**
 * Renders a permission as `[ value ]` — the same notation whether it's an
 * allowlisted action, a spend cap, or an expiry. The bracket is structural,
 * not decorative: it's literally what a session's `calls` / `spend` /
 * `expiry` fields mean, made visible.
 */
export function Bound({ kind, value, live, className }: BoundProps) {
  return (
    <div className={`rb-bound ${className ?? ""}`}>
      <span className="rb-bound-label">{LABEL[kind]}</span>
      <span className="rb-bound-value">
        <span className="rb-bound-bracket" aria-hidden="true">
          [
        </span>
        {value}
        <span className="rb-bound-bracket" aria-hidden="true">
          ]
        </span>
        {live && <span className="rb-bound-live" aria-hidden="true" />}
      </span>
    </div>
  );
}

/** Same notation, but the value is a live countdown to a real expiry. */
export function CountdownBound({ expiresAt, className }: { expiresAt: Date; className?: string }) {
  const [label, setLabel] = useState(() => formatCountdown(expiresAt));

  useEffect(() => {
    const id = setInterval(() => setLabel(formatCountdown(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return <Bound kind="until" value={label} live className={className} />;
}

function formatCountdown(target: Date): string {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return "expired";
  const totalSeconds = Math.floor(diffMs / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
