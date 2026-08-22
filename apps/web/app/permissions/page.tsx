import { Card, Button } from "@rangebook/ui";

// Stub: renders the shape of the page. Session 2 replaces CATEGORIES-style
// sample data with a real query against @rangebook/db's sessions_cache,
// verified live against Altana Keystore before the revoke button is
// actionable — see packages/altana/src/session.ts:isSessionValid.
export default function PermissionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        Permissions
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--color-mist)" }}>
        Every agent you&apos;ve activated, and exactly what it&apos;s allowed to do.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-medium">Health Factor Monitoring — Venus position</p>
            <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-data)", color: "var(--color-mist)" }}>
              supply · repay — up to 200 BUSD/day — expires in 22:41:12
            </p>
          </div>
          <Button variant="danger">Revoke</Button>
        </Card>

        <p className="text-sm" style={{ color: "var(--color-mist)" }}>
          No other agents activated yet.
        </p>
      </div>
    </div>
  );
}
