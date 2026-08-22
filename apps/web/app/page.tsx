import { Bound, CountdownBound, Button, Card } from "@rangebook/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface AgentMetric {
  metric_label: string | null;
}

interface AgentWithMetrics {
  id: string;
  category: string;
  name: string;
  tagline: string;
  metrics: Record<string, AgentMetric>;
}

const CATEGORY_META: Record<string, { slug: string; name: string; blurb: string; statKey: string | null }> = {
  rebalancing: {
    slug: "rebalancing",
    name: "Rebalancing",
    blurb: "Keeps your liquidity position in range, automatically.",
    statKey: null, // no agent-agnostic market number yet — see apps/api/src/jobs/refreshMetrics.ts
  },
  grid_trading: {
    slug: "grid-trading",
    name: "Grid Trading",
    blurb: "Places and manages a grid of orders so you don't watch the chart.",
    statKey: null,
  },
  yield_optimisation: {
    slug: "yield-optimisation",
    name: "Yield Optimisation",
    blurb: "Moves liquidity to wherever the real yield actually is.",
    statKey: "best_apr", // real: compares live Aave + Venus rates, see refreshMetrics.ts
  },
  health_factor_monitoring: {
    slug: "health-factor-monitoring",
    name: "Health Factor Monitoring",
    blurb: "Watches your lending position and defends it before liquidation.",
    statKey: null,
  },
};

const STEPS = [
  {
    title: "Choose an agent",
    body: "Browse by category and see exactly what it does, with real numbers, before you commit to anything.",
  },
  {
    title: "Set the bound",
    body: "Pick what it may touch, how much it may spend, and until when. Nothing wider than that is possible.",
  },
  {
    title: "It works, provably",
    body: "Every action lands inside that bound. Verify it or pull it at any time from Permissions.",
  },
];

async function getAgents(): Promise<AgentWithMetrics[] | null> {
  try {
    const res = await fetch(`${API_URL}/agents`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const body = await res.json();
    return body.agents ?? [];
  } catch {
    // API not reachable — render the honest "not deployed yet" state
    // instead of crashing the whole page.
    return null;
  }
}

const heroExpiry = new Date(Date.now() + 22 * 60 * 60 * 1000 + 41 * 60 * 1000);

export default async function MarketplacePage() {
  const agents = await getAgents();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span style={{ color: "var(--color-brass)" }}>[</span> Rangebook{" "}
          <span style={{ color: "var(--color-brass)" }}>]</span>
        </span>
        <nav className="flex items-center gap-6 text-sm" style={{ color: "var(--color-mist)" }}>
          <a href="#agents" className="hover:text-[var(--color-paper)]">
            Agents
          </a>
          <a href="/permissions" className="hover:text-[var(--color-paper)]">
            Permissions
          </a>
          <Button variant="ghost">Connect wallet</Button>
        </nav>
      </header>

      {/* Hero — illustrative on purpose. A live real session belongs to a
          specific wallet; showing one on the public homepage would mean
          exposing a real user's data, which isn't something to do even if
          it were technically easy. */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 md:pt-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p
              className="mb-4 text-xs font-semibold tracking-[0.15em]"
              style={{ color: "var(--color-signal)" }}
            >
              BNB CHAIN AGENT MARKETPLACE
            </p>
            <h1
              className="text-4xl leading-[1.1] font-semibold tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Every agent here works inside a bound you set —
              <span style={{ color: "var(--color-mist)" }}> enforced onchain, not promised in a pitch.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed" style={{ color: "var(--color-mist)" }}>
              Rebalancing, grid trading, yield routing, liquidation defense. Hire any of them, and see exactly
              what they&apos;re allowed to touch, spend, and until when — before you say yes.
            </p>
            <div className="mt-8 flex gap-3">
              <Button variant="primary">Browse agents</Button>
              <Button variant="ghost">How permissions work</Button>
            </div>
          </div>

          <Card className="!p-8">
            <p className="mb-6 text-xs font-semibold tracking-[0.1em]" style={{ color: "var(--color-mist)" }}>
              HOW A SESSION LOOKS
            </p>
            <p
              className="mb-6 text-sm font-medium"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-paper)" }}
            >
              Health Factor Monitoring — example
            </p>
            <div className="flex flex-col gap-5">
              <Bound kind="may" value="supply · repay" />
              <Bound kind="cap" value="200 BUSD / day" />
              <CountdownBound expiresAt={heroExpiry} />
            </div>
          </Card>
        </div>
      </section>

      {/* Categories — real metrics where an agent is deployed and a real
          market number exists; an honest "not deployed yet" otherwise. */}
      <section id="agents" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Browse by what you need
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {Object.entries(CATEGORY_META).map(([category, meta]) => {
            const agent = agents?.find((a) => a.category === category);
            const stat = agent && meta.statKey ? agent.metrics[meta.statKey]?.metric_label : null;
            const reputation = agent?.metrics["reputation_score"]?.metric_label;

            return (
              <Card key={category} className="flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    {meta.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-mist)" }}>
                    {meta.blurb}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  {stat || reputation ? (
                    <span
                      className="text-sm"
                      style={{ fontFamily: "var(--font-data)", color: "var(--color-signal)" }}
                    >
                      [ {stat ?? reputation} ]
                    </span>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--color-mist)" }}>
                      Not deployed yet
                    </span>
                  )}
                  <a
                    href={agent ? `/agents/${meta.slug}` : "/DEPLOY.md"}
                    className="text-sm font-medium hover:underline"
                  >
                    {agent ? "View agent →" : "Deploy this agent →"}
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How activation works — a real sequence, so numbering is honest here */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          How activation works
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <span
                className="text-sm"
                style={{ fontFamily: "var(--font-data)", color: "var(--color-brass)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-mist)" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t" style={{ borderColor: "var(--color-rule)" }}>
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm" style={{ color: "var(--color-mist)" }}>
          Every session is registered the moment it&apos;s granted, in a registry anyone can read. Verify what
          an agent may do — or revoke it — without asking us.
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-xs" style={{ color: "var(--color-mist)" }}>
        Rangebook · built for BNB Agent Studio · agents run on BNB Chain
      </footer>
    </div>
  );
}
