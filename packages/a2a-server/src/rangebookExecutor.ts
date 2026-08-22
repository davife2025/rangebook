import { v4 as uuidv4 } from "uuid";
import type { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";
import type { Task, TaskStatusUpdateEvent, TaskArtifactUpdateEvent, Message } from "@a2a-js/sdk";
import { getTrackedPosition, getGridConfig } from "@rangebook/db";
import { fulfillAuditJob } from "@rangebook/agent-health-factor";
import { fulfillRebalanceJob } from "@rangebook/agent-rebalancing";
import { fulfillGridJob } from "@rangebook/agent-grid-trading";
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

      case "rebalance-liquidity": {
        const tracked = await getTrackedPosition(targetWallet);
        if (!tracked) {
          this.fail(
            eventBus,
            taskId,
            contextId,
            `No LP position is tracked for ${targetWallet} yet — set one up at rangebook.xyz first ` +
              `(POST /positions/rebalancing). Reading and checking a position is real once one is tracked; ` +
              `only the actual rebalance write is still a documented stub in packages/agent-rebalancing.`,
          );
          return;
        }

        try {
          const result = await fulfillRebalanceJob({
            positionTokenId: BigInt(tracked.position_token_id),
            positionManagerAddress: tracked.position_manager_address as `0x${string}`,
            rangeWidthTicks: tracked.range_width_ticks,
            sessionKeyAddress: session.sessionKeyAddress,
            sessionSigner: signer,
            walletAddress: targetWallet,
          });
          this.completeWithArtifact(eventBus, taskId, contextId, "rebalance-result", result);
        } catch (err) {
          // Expected to land here whenever checkRange finds the position
          // out of range — rebalance() itself still throws on purpose
          // (see packages/agent-rebalancing/src/rebalance.ts). A position
          // that's in range completes normally above; this only fires on
          // the genuinely unbuilt path.
          this.fail(eventBus, taskId, contextId, err instanceof Error ? err.message : "Unknown error");
        }
        return;
      }

      case "run-grid": {
        const config = await getGridConfig(targetWallet);
        if (!config) {
          this.fail(
            eventBus,
            taskId,
            contextId,
            `No grid is configured for ${targetWallet} yet — set one up at rangebook.xyz first ` +
              `(POST /positions/grid).`,
          );
          return;
        }

        const currentPrice = Number(userMessage.metadata?.currentPrice ?? NaN);
        const baseDecimals = userMessage.metadata?.baseDecimals;
        const quoteDecimals = userMessage.metadata?.quoteDecimals;
        if (Number.isNaN(currentPrice) || typeof baseDecimals !== "number" || typeof quoteDecimals !== "number") {
          this.fail(
            eventBus,
            taskId,
            contextId,
            "run-grid needs metadata.currentPrice, metadata.baseDecimals, and metadata.quoteDecimals — " +
              "decimals aren't guessed here since a wrong guess sizes a real trade wrong, not just a display value.",
          );
          return;
        }

        try {
          const result = await fulfillGridJob({
            config: {
              levels: config.levels,
              pair: { base: config.base_token as `0x${string}`, quote: config.quote_token as `0x${string}` },
            },
            currentPrice,
            sessionKeyAddress: session.sessionKeyAddress,
            sessionSigner: signer,
            walletAddress: targetWallet,
            universalRouterAddress: config.universal_router_address as `0x${string}`,
            amountPerLevel: BigInt(config.amount_per_level),
            baseDecimals,
            quoteDecimals,
          });
          this.completeWithArtifact(eventBus, taskId, contextId, "grid-result", result);
        } catch (err) {
          // Fires either for a missing/invalid currentPrice, or — once a
          // level genuinely triggers — for executeLevel's still-unbuilt
          // Universal Router encoding (packages/agent-grid-trading).
          this.fail(eventBus, taskId, contextId, err instanceof Error ? err.message : "Unknown error");
        }
        return;
      }
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
