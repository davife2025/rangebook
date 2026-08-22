import { notFound } from "next/navigation";
import { Card } from "@rangebook/ui";
import { CATEGORY_SKILLS, contractsFor } from "@rangebook/altana";
import type { AgentCategory } from "@rangebook/db";
import { ActivateForm } from "../../../components/ActivateForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

const SLUG_TO_CATEGORY: Record<string, AgentCategory> = {
  rebalancing: "rebalancing",
  "grid-trading": "grid_trading",
  "yield-optimisation": "yield_optimisation",
  "health-factor-monitoring": "health_factor_monitoring",
};

interface AgentWithSigner {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  status: string;
  sessionSignerAddress: `0x${string}` | null;
  metrics: Record<string, { metric_label: string | null }>;
}

async function getAgent(category: AgentCategory): Promise<AgentWithSigner | null> {
  try {
    const res = await fetch(`${API_URL}/agents?category=${category}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return body.agents?.[0] ?? null;
  } catch {
    return null;
  }
}

export default async function AgentDetailPage({ params }: { params: { category: string } }) {
  const category = SLUG_TO_CATEGORY[params.category];
  if (!category) notFound();

  const agent = await getAgent(category);
  const skillConfig = CATEGORY_SKILLS[category];

  // Contract allowlist and skill config are resolved here, server-side,
  // and passed down as props — deliberately not duplicated behind
  // NEXT_PUBLIC_ vars for the client to re-read, since these values only
  // need to exist once.
  let contracts: `0x${string}`[] = [];
  try {
    contracts = contractsFor(category);
  } catch {
    // Allowlist env var not set yet — ActivateForm shows this as "not configured."
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.1em]" style={{ color: "var(--color-mist)" }}>
        {agent ? agent.status.toUpperCase() : "NOT DEPLOYED"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        {agent?.name ?? skillConfig.category}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "var(--color-mist)" }}>
        {agent?.description ?? "This agent hasn't been deployed yet — see DEPLOY.md."}
      </p>

      <Card className="mt-8">
        <p className="mb-3 text-xs font-semibold tracking-[0.1em]" style={{ color: "var(--color-mist)" }}>
          WHAT THE SESSION ALLOWS
        </p>
        <p className="text-sm" style={{ fontFamily: "var(--font-data)", color: "var(--color-signal)" }}>
          {skillConfig.altanaSkills.join(", ")}
        </p>
        <p className="mt-4 mb-2 text-xs font-semibold tracking-[0.1em]" style={{ color: "var(--color-mist)" }}>
          WHAT IT MAY NOT DO
        </p>
        <ul className="text-sm leading-relaxed" style={{ color: "var(--color-mist)" }}>
          {skillConfig.mayNot.map((item) => (
            <li key={item}>— {item}</li>
          ))}
        </ul>
      </Card>

      {agent && (
        <ActivateForm
          category={category}
          agentId={agent.id}
          sessionSignerAddress={agent.sessionSignerAddress}
          contracts={contracts}
          defaultSpend={skillConfig.defaultSpend}
          defaultExpirySeconds={skillConfig.defaultExpirySeconds}
          positionManagerAddress={process.env.NEXT_PUBLIC_CL_POSITION_MANAGER_ADDRESS as `0x${string}` | undefined}
          universalRouterAddress={process.env.NEXT_PUBLIC_UNIVERSAL_ROUTER_ADDRESS as `0x${string}` | undefined}
        />
      )}

      {!agent && (
        <Card className="mt-8">
          <p className="text-sm" style={{ color: "var(--color-mist)" }}>
            Nothing to activate until this agent is deployed — see{" "}
            <code style={{ fontFamily: "var(--font-data)" }}>DEPLOY.md</code>.
          </p>
        </Card>
      )}
    </div>
  );
}
