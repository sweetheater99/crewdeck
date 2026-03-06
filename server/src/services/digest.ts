import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@crewdeck/db";
import {
  issues,
  agents,
  heartbeatRuns,
  costEvents,
  companies,
  notificationChannels,
} from "@crewdeck/db";
import { logger } from "../middleware/logger.js";
import { sendTelegram } from "./notification-senders/telegram.js";
import { sendDiscord } from "./notification-senders/discord.js";
import { sendWebhook } from "./notification-senders/webhook.js";

/* ------------------------------------------------------------------ */
/*  Digest generation                                                  */
/* ------------------------------------------------------------------ */

interface DigestResult {
  html: string;
  plain: string;
}

export function digestService(db: Db) {
  async function generateDigest(
    companyId: string,
    since: Date,
  ): Promise<DigestResult> {
    const dateStr = since.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Tasks completed since date
    const [completedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.status, "done"),
          gte(issues.completedAt, since),
        ),
      );
    const tasksCompleted = completedResult?.count ?? 0;

    // Tasks failed (heartbeat_runs with status = 'failed' since date)
    const [failedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(heartbeatRuns)
      .where(
        and(
          eq(heartbeatRuns.companyId, companyId),
          eq(heartbeatRuns.status, "failed"),
          gte(heartbeatRuns.finishedAt, since),
        ),
      );
    const tasksFailed = failedResult?.count ?? 0;

    // Cost sum since date (in cents)
    const [costResult] = await db
      .select({ total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int` })
      .from(costEvents)
      .where(
        and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, since),
        ),
      );
    const spentCents = costResult?.total ?? 0;

    // Company budget info
    const [company] = await db
      .select({
        budgetMonthlyCents: companies.budgetMonthlyCents,
        spentMonthlyCents: companies.spentMonthlyCents,
      })
      .from(companies)
      .where(eq(companies.id, companyId));
    const budgetCents = company?.budgetMonthlyCents ?? 0;
    const remainingCents = Math.max(0, budgetCents - (company?.spentMonthlyCents ?? 0));

    // Per-agent breakdown
    const agentRows = await db
      .select({
        agentId: agents.id,
        agentName: agents.name,
        agentStatus: agents.status,
        budgetMonthlyCents: agents.budgetMonthlyCents,
        spentMonthlyCents: agents.spentMonthlyCents,
        consecutiveFailures: agents.consecutiveFailures,
        retryPolicy: agents.retryPolicy,
      })
      .from(agents)
      .where(eq(agents.companyId, companyId));

    // Count tasks done per agent since date
    const agentTaskCounts = await db
      .select({
        agentId: issues.assigneeAgentId,
        count: sql<number>`count(*)::int`,
      })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.status, "done"),
          gte(issues.completedAt, since),
        ),
      )
      .groupBy(issues.assigneeAgentId);

    const agentTaskMap = new Map(
      agentTaskCounts.map((r) => [r.agentId, r.count]),
    );

    // Review pending count
    const [reviewResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.reviewStatus, "pending_review"),
        ),
      );
    const reviewPending = reviewResult?.count ?? 0;

    // Escalated agents (consecutiveFailures >= maxRetries)
    const escalatedAgents = agentRows.filter((a) => {
      const maxRetries = a.retryPolicy?.maxRetries ?? 3;
      return a.consecutiveFailures >= maxRetries;
    });

    // Budget warnings (agents at >80%)
    const budgetWarnings = agentRows.filter((a) => {
      if (a.budgetMonthlyCents <= 0) return false;
      return a.spentMonthlyCents / a.budgetMonthlyCents > 0.8;
    });

    // Issues in backlog (ready) vs blocked
    const [backlogResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(
        and(eq(issues.companyId, companyId), eq(issues.status, "backlog")),
      );
    const backlogCount = backlogResult?.count ?? 0;

    const [blockedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(
        and(eq(issues.companyId, companyId), eq(issues.status, "blocked")),
      );
    const blockedCount = blockedResult?.count ?? 0;

    // Build HTML (for Telegram)
    const spentStr = `$${(spentCents / 100).toFixed(2)}`;
    const remainingStr = `$${(remainingCents / 100).toFixed(2)}`;

    const lines: string[] = [
      `<b>Crewdeck Daily Digest</b>`,
      dateStr,
      "",
      `<b>Overnight Summary:</b>`,
      `- ${tasksCompleted} tasks completed, ${tasksFailed} failed`,
      `- ${spentStr} spent (${remainingStr} remaining this month)`,
    ];

    // Agent status
    if (agentRows.length > 0) {
      lines.push("", `<b>Agent Status:</b>`);
      for (const agent of agentRows) {
        const done = agentTaskMap.get(agent.agentId) ?? 0;
        lines.push(`- ${agent.agentName}: ${done} tasks done, ${agent.agentStatus}`);
      }
    }

    // Needs attention
    const attentionItems: string[] = [];
    if (reviewPending > 0) {
      attentionItems.push(`- Review queue: ${reviewPending} items pending`);
    }
    for (const agent of escalatedAgents) {
      attentionItems.push(
        `- ${agent.agentName} has hit ${agent.consecutiveFailures} consecutive failures`,
      );
    }
    for (const agent of budgetWarnings) {
      const pct = Math.round((agent.spentMonthlyCents / agent.budgetMonthlyCents) * 100);
      attentionItems.push(`- ${agent.agentName} at ${pct}% monthly budget`);
    }
    if (attentionItems.length > 0) {
      lines.push("", `<b>Needs Your Attention:</b>`, ...attentionItems);
    }

    // Today's queue
    lines.push(
      "",
      `<b>Today's Queue:</b>`,
      `- ${backlogCount} tasks ready to execute`,
      `- ${blockedCount} tasks blocked`,
    );

    const html = lines.join("\n");

    // Plain text: strip HTML tags
    const plain = html.replace(/<[^>]+>/g, "");

    return { html, plain };
  }

  /* ---------------------------------------------------------------- */
  /*  Digest delivery                                                  */
  /* ---------------------------------------------------------------- */

  async function sendDigestToChannel(
    channel: {
      id: string;
      channelType: string;
      config: Record<string, unknown>;
      companyId: string;
    },
    digest: DigestResult,
  ): Promise<void> {
    switch (channel.channelType) {
      case "telegram": {
        await sendTelegram(
          {
            botToken: channel.config.botToken as string,
            chatId: channel.config.chatId as string,
          },
          digest.html,
        );
        break;
      }
      case "discord": {
        await sendDiscord(
          { webhookUrl: channel.config.webhookUrl as string },
          digest.plain,
        );
        break;
      }
      case "webhook": {
        await sendWebhook(
          {
            url: channel.config.url as string,
            secret: channel.config.secret as string | undefined,
          },
          {
            eventType: "digest.daily",
            payload: { html: digest.html, plain: digest.plain },
            timestamp: new Date().toISOString(),
          },
        );
        break;
      }
      default:
        logger.warn(
          { channelType: channel.channelType, channelId: channel.id },
          "unknown notification channel type for digest",
        );
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Digest scheduler                                                 */
  /* ---------------------------------------------------------------- */

  // Track which channel+date combos have already been sent to avoid duplicates
  const sentDigests = new Set<string>();

  /**
   * Check all digest-enabled channels and send if the current time matches
   * their configured digestTime in their timezone.
   */
  async function checkDigestSchedule(): Promise<void> {
    try {
      const channels = await db
        .select()
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.enabled, true),
            eq(notificationChannels.digestEnabled, true),
          ),
        );

      if (channels.length === 0) return;

      for (const channel of channels) {
        try {
          const tz = channel.digestTimezone ?? "UTC";
          const digestTime = channel.digestTime; // e.g. "08:00"
          if (!digestTime) continue;

          // Get current time in the channel's timezone
          const now = new Date();
          const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const parts = formatter.formatToParts(now);
          const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
          const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
          const currentHHMM = `${hour}:${minute}`;

          if (currentHHMM !== digestTime) continue;

          // Date key for dedup (YYYY-MM-DD in the channel's timezone)
          const dateFormatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
          const dateKey = dateFormatter.format(now);
          const dedupKey = `${channel.id}:${dateKey}`;

          if (sentDigests.has(dedupKey)) continue;

          // Mark as sent before sending to prevent race conditions
          sentDigests.add(dedupKey);

          // Generate digest for the last 24 hours
          const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          const digest = await generateDigest(channel.companyId, since);

          await sendDigestToChannel(channel, digest);

          logger.info(
            { channelId: channel.id, companyId: channel.companyId, digestTime },
            "daily digest sent",
          );

          // Prune old dedup keys (keep only last 7 days worth)
          if (sentDigests.size > 1000) {
            sentDigests.clear();
          }
        } catch (err) {
          logger.warn(
            { err, channelId: channel.id },
            "failed to send daily digest for channel",
          );
        }
      }
    } catch (err) {
      logger.warn({ err }, "digest schedule check failed");
    }
  }

  return {
    generateDigest,
    checkDigestSchedule,
  };
}
