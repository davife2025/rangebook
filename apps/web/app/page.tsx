import { Bound, CountdownBound, Button, Card } from "@rangebook/ui";

// Sample shape only — replace once agents are deployed and apps/api is
// wired to live 8004scan + chain reads. Never ship these as real numbers.
const CATEGORIES = [
  {
    slug: "rebalancing",
    name: "Rebalancing",
    blurb: "Keeps your liquidity position in range, automatically.",
    stat: "in range · 92% uptime",
  },
  {
    slug: "grid-trading",
    name: "Grid Trading",
    blurb: "Places and manages a grid of orders so you don't watch the chart.",
    stat: "12 levels active",
  },
  {
    slug: "yield-optimisation",
    name: "Yield Optimisation",
    blurb: "Moves liquidity to wherever the real yield actually is.",
    stat: "8.2% best APR found",
  },
  {
    slug: "health-factor-monitoring",
    name: "Health Factor Monitoring",
    blurb: "Watches your lending position and defends it before liquidation.",
    stat: "HF 1.34",
  },
];

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

const heroExpiry = new Date(Date.now() + 22 * 60 * 60 * 1000 + 41 * 60 * 1000);

export default function MarketplacePage() {
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

      {/* Hero — the thesis, made concrete rather than claimed */}
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
              A REAL SESSION, RIGHT NOW
            </p>
            <p
              className="mb-6 text-sm font-medium"
              style={{ fontFamily: "var(--font-display)", color: "var(--color-paper)" }}
            >
              Health Factor Monitoring — Venus position
            </p>
            <div className="flex flex-col gap-5">
              <Bound kind="may" value="supply · repay" />
              <Bound kind="cap" value="200 BUSD / day" />
              <CountdownBound expiresAt={heroExpiry} />
            </div>
          </Card>
        </div>
      </section>

      {/* Categories — real shape, not icon + adjective */}
      <section id="agents" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          Browse by what you need
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <Card key={c.slug} className="flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  {c.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-mist)" }}>
                  {c.blurb}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ fontFamily: "var(--font-data)", color: "var(--color-signal)" }}
                >
                  [ {c.stat} ]
                </span>
                <a href={`/agents/${c.slug}`} className="text-sm font-medium hover:underline">
                  View agent →
                </a>
              </div>
            </Card>
          ))}
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
