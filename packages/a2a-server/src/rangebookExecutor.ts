import { v4 as uuidv4 } from "uuid";
import type { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";
import type { Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent, Message } from "@a2a-js/sdk";
import { fulfillAuditJob } from "@rangebook/agent-health-factor";
import { getAaveSupplyApr, getVenusSupplyApr, fulfillYieldJob } from "@rangebook/agent-yield-optimisation";
import { resolveSkill, extractWalletAddress, SKILL_TO_CATEGORY, type SkillId } from "./skillRouter";
import { getActiveSessionForWallet } from "./lib/sessionLookup";
import { getAgentSessionSigner } from "./lib/agentSigner";

export class RangebookExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { taskId, contextId, userMessage, task } = requestContext;

    if (!task) {
      eventBus.publish({
        kind: "task",
        id: taskId,
        contextId,
        status: { state: "submitted", timestamp: new Date().toISOString() },
        history: [userMessage],
      } satisfies Task);
    }

    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId,
      status: { state: "working", timestamp: new Date().toISOString() },
      final: false,
    } satisfies TaskStatusUpdateEvent);

    const skillId = resolveSkill(userMessage);
    if (!skillId) {
      this.fail(
        eventBus,
        taskId,
        contextId,
        "Couldn't tell which skill you meant — mention health factor, rebalancing, grid, or yield, " +
          "or set metadata.skillId to one of: monitor-health-factor, rebalance-liquidity, run-grid, optimize-yield.",
      );
      return;
    }

    try {
      await this.dispatch(skillId, userMessage, taskId, contextId, eventBus);
    } catch (err) {
      this.fail(eventBus, taskId, contextId, err instanceof Error ? err.message : "Unknown error");
    }
  }

  async cancelTask(): Promise<void> {
    // Every skill here runs to completion (or throws) in one pass — nothing
    // long-running enough yet to need mid-flight cancellation.
  }

  private async dispatch(
    skillId: SkillId,
    userMessage: Message,
    taskId: string,
    contextId: string,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    // optimize-yield's plain rate comparison needs no wallet, no session —
    // it's the same public read the marketplace cards already show.
    if (skillId === "optimize-yield" && !userMessage.metadata?.currentVenue) {
      const aaveAsset = requireEnv("YIELD_REFERENCE_AAVE_ASSET") as `0x${string}`;
      const venusVToken = requireEnv("YIELD_REFERENCE_VENUS_VTOKEN") as `0x${string}`;
      const [aaveApr, venusApr] = await Promise.all([getAaveSupplyApr(aaveAsset), getVenusSupplyApr(venusVToken)]);

      this.completeWithArtifact(eventBus, taskId, contextId, "yield-rates", {
        aaveApr,
        venusApr,
        best: aaveApr >= venusApr ? "aave-v3" : "venus",
        note: "No current-venue supplied, so this is a rate check, not a move recommendation.",
      });
      return;
    }

    const targetWallet = extractWalletAddress(userMessage);
    if (!targetWallet) {
      this.fail(eventBus, taskId, contextId, "No wallet address found — expected something like 'Audit wallet 0x…'.");
      return;
    }

    const category = SKILL_TO_CATEGORY[skillId];
    const session = await getActiveSessionForWallet(targetWallet, category);
    if (!session) {
      eventBus.publish({
        kind: "status-update",
        taskId,
        contextId,
        status: {
          state: "auth-required",
          message: this.textMessage(
            `No active session for ${targetWallet} on this skill. The wallet owner needs to activate ` +
              `it at rangebook.xyz first — grant and revoke stay with them, not with this endpoint.`,
          ),
          timestamp: new Date().toISOString(),
        },
        final: true,
      } satisfies TaskStatusUpdateEvent);
      eventBus.finished();
      return;
    }

    const signer = getAgentSessionSigner(category);

    switch (skillId) {
      case "monitor-health-factor": {
        const result = await fulfillAuditJob({
          targetWallet,
          sessionKeyAddress: session.sessionKeyAddress,
          sessionSigner: signer,
          aavePoolAddress: requireEnv("AAVE_V3_POOL_ADDRESS") as `0x${string}`,
          debtAsset: requireEnv("HEALTH_FACTOR_DEBT_ASSET") as `0x${string}`,
        });
        this.completeWithArtifact(eventBus, taskId, contextId, "health-factor-audit", result);
        return;
      }

      case "optimize-yield": {
        const result = await fulfillYieldJob({
          currentVenue: userMessage.metadata!.currentVenue as "aave-v3" | "venus",
          aaveAsset: requireEnv("YIELD_REFERENCE_AAVE_ASSET") as `0x${string}`,
          venusVToken: requireEnv("YIELD_REFERENCE_VENUS_VTOKEN") as `0x${string}`,
          switchThresholdBps: 20,
        });
        this.completeWithArtifact(eventBus, taskId, contextId, "yield-comparison", result);
        return;
      }

      case "rebalance-liquidity":
        // Same gap as packages/agent-rebalancing/src/monitor.ts:readPosition
        // — Infinity's CLPositionManager read isn't implemented, and on top
        // of that, this repo doesn't yet track *which* position (tokenId)
        // belongs to which wallet. Two real gaps, not one — both need
        // solving before this skill can run, not just the chain call.
        this.fail(
          eventBus,
          taskId,
          contextId,
          "Rebalancing isn't wired up yet: no LP position tracking exists, and the Infinity " +
            "CLPositionManager read is still a documented stub in packages/agent-rebalancing.",
        );
        return;

      case "run-grid":
        // Same story: packages/agent-grid-trading/src/execute.ts defers the
        // actual swap to the Altana skill on purpose, and there's no
        // storage yet for a wallet's grid configuration or a live price
        // feed to check it against.
        this.fail(
          eventBus,
          taskId,
          contextId,
          "Grid trading isn't wired up yet: no grid configuration storage exists, and the swap " +
            "execution is still a documented stub in packages/agent-grid-trading.",
        );
        return;
    }
  }

  private completeWithArtifact(
    eventBus: ExecutionEventBus,
    taskId: string,
    contextId: string,
    name: string,
    data: unknown,
  ): void {
    eventBus.publish({
      kind: "artifact-update",
      taskId,
      contextId,
      artifact: { artifactId: uuidv4(), name, parts: [{ kind: "data", data }] },
    } satisfies TaskArtifactUpdateEvent);

    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId,
      status: { state: "completed", timestamp: new Date().toISOString() },
      final: true,
    } satisfies TaskStatusUpdateEvent);
    eventBus.finished();
  }

  private fail(eventBus: ExecutionEventBus, taskId: string, contextId: string, reason: string): void {
    eventBus.publish({
      kind: "status-update",
      taskId,
      contextId,
      status: { state: "failed", message: this.textMessage(reason), timestamp: new Date().toISOString() },
      final: true,
    } satisfies TaskStatusUpdateEvent);
    eventBus.finished();
  }

  private textMessage(text: string): Message {
    return { kind: "message", messageId: uuidv4(), role: "agent", parts: [{ kind: "text", text }] };
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
