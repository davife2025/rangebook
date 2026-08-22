import { Card } from "@rangebook/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface Task {
  id: string;
  task_title: string;
  task_description: string;
  is_trading_stock_or_security: boolean;
  with_agent_time_seconds: number | null;
  with_agent_cost_usd: number | null;
  with_agent_output_url: string | null;
  with_agent_quality_score: number | null;
  without_agent_time_seconds: number | null;
  without_agent_cost_usd: number | null;
  without_agent_output_url: string | null;
  without_agent_quality_score: number | null;
  win_rate_pct: number | null;
  risk_description: string | null;
  window_start: string | null;
  window_end: string | null;
  agents: { name: string; category: string } | null;
}

async function getTasks(): Promise<Task[] | null> {
  try {
    const res = await fetch(`${API_URL}/advantage-report/tasks`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return body.tasks ?? [];
  } catch {
    return null;
  }
}

function fmtTime(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function fmtUsd(v: number | null): string {
  return v == null ? "—" : `$${v.toFixed(2)}`;
}

function isComplete(t: Task): boolean {
  return t.with_agent_time_seconds != null && t.without_agent_time_seconds != null;
}

export default async function AdvantageReportPage() {
  const tasks = await getTasks();
  const completeCount = tasks?.filter(isComplete).length ?? 0;
  const hasTradingTask = tasks?.some((t) => t.is_trading_stock_or_security && isComplete(t)) ?? false;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        Agent Advantage Report
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-mist)" }}>
        Real tasks, run both with an agent hired through Rangebook and without. Time, cost, and quality for
        each, actual outputs attached. Full protocol in{" "}
        <code style={{ fontFamily: "var(--font-data)" }}>ADVANTAGE_REPORT_METHODOLOGY.md</code>.
      </p>

      <div className="mt-6 flex gap-6 text-sm" style={{ fontFamily: "var(--font-data)" }}>
        <span style={{ color: completeCount >= 3 ? "var(--color-signal)" : "var(--color-mist)" }}>
          [ {completeCount} / 3 required tasks recorded ]
        </span>
        <span style={{ color: hasTradingTask ? "var(--color-signal)" : "var(--color-negative)" }}>
          [ trading task: {hasTradingTask ? "recorded" : "still needed"} ]
        </span>
      </div>

      <div className="mt-10 flex flex-col gap-6">
        {tasks === null && (
          <Card>
            <p className="text-sm" style={{ color: "var(--color-negative)" }}>
              Couldn&apos;t reach the API — this page has nothing to show without it.
            </p>
          </Card>
        )}

        {tasks?.length === 0 && (
          <Card>
            <p className="text-sm" style={{ color: "var(--color-mist)" }}>
              No tasks recorded yet. Nothing here is a placeholder number — see{" "}
              <code style={{ fontFamily: "var(--font-data)" }}>ADVANTAGE_REPORT_METHODOLOGY.md</code> to run the
              first comparison, then <code style={{ fontFamily: "var(--font-data)" }}>POST /advantage-report/tasks</code>{" "}
              to record it.
            </p>
          </Card>
        )}

        {tasks?.map((task) => (
          <Card key={task.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  {task.task_title}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--color-mist)" }}>
                  {task.agents?.name ?? "Unassigned"} {task.is_trading_stock_or_security && "· trading task"}
                </p>
              </div>
              {!isComplete(task) && (
                <span
                  className="whitespace-nowrap text-xs"
                  style={{ fontFamily: "var(--font-data)", color: "var(--color-mist)" }}
                >
                  in progress
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-paper)" }}>
              {task.task_description}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
              <div />
              <div className="font-medium" style={{ color: "var(--color-signal)" }}>
                With agent
              </div>
              <div className="font-medium" style={{ color: "var(--color-mist)" }}>
                Without
              </div>

              <div style={{ color: "var(--color-mist)" }}>Time</div>
              <div style={{ fontFamily: "var(--font-data)" }}>{fmtTime(task.with_agent_time_seconds)}</div>
              <div style={{ fontFamily: "var(--font-data)" }}>{fmtTime(task.without_agent_time_seconds)}</div>

              <div style={{ color: "var(--color-mist)" }}>Cost</div>
              <div style={{ fontFamily: "var(--font-data)" }}>{fmtUsd(task.with_agent_cost_usd)}</div>
              <div style={{ fontFamily: "var(--font-data)" }}>{fmtUsd(task.without_agent_cost_usd)}</div>

              <div style={{ color: "var(--color-mist)" }}>Quality (1–5)</div>
              <div style={{ fontFamily: "var(--font-data)" }}>{task.with_agent_quality_score ?? "—"}</div>
              <div style={{ fontFamily: "var(--font-data)" }}>{task.without_agent_quality_score ?? "—"}</div>
            </div>

            {task.is_trading_stock_or_security && (task.win_rate_pct != null || task.risk_description) && (
              <div className="mt-4 flex gap-6 text-sm" style={{ fontFamily: "var(--font-data)" }}>
                {task.win_rate_pct != null && (
                  <span style={{ color: "var(--color-brass)" }}>[ win rate: {task.win_rate_pct}% ]</span>
                )}
                {task.window_start && task.window_end && (
                  <span style={{ color: "var(--color-mist)" }}>
                    [ window: {new Date(task.window_start).toLocaleDateString()} –{" "}
                    {new Date(task.window_end).toLocaleDateString()} ]
                  </span>
                )}
              </div>
            )}
            {task.risk_description && (
              <p className="mt-2 text-xs" style={{ color: "var(--color-mist)" }}>
                Risk: {task.risk_description}
              </p>
            )}

            <div className="mt-4 flex gap-4 text-xs">
              {task.with_agent_output_url && (
                <a href={task.with_agent_output_url} className="hover:underline" style={{ color: "var(--color-signal)" }}>
                  With-agent output →
                </a>
              )}
              {task.without_agent_output_url && (
                <a href={task.without_agent_output_url} className="hover:underline" style={{ color: "var(--color-mist)" }}>
                  Manual output →
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
