import { and, eq } from "drizzle-orm";
import type { Db } from "@crewdeck/db";
import { notificationChannels, notificationRules } from "@crewdeck/db";
import { logger } from "../middleware/logger.js";
import { sendTelegram } from "./notification-senders/telegram.js";
import { sendDiscord } from "./notification-senders/discord.js";
import { sendWebhook } from "./notification-senders/webhook.js";

/* ------------------------------------------------------------------ */
/*  Message formatters (HTML for Telegram)                            */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatters: Record<string, (p: any) => string> = {
  "task.completed": (p) =>
    `<b>Task completed</b>\n#${p.issueIdentifier}: ${p.issueTitle}\nAgent: ${p.agentName}\nCost: $${(p.costCents / 100).toFixed(2)}`,

  "task.failed": (p) =>
    `<b>Task failed</b>\n#${p.issueIdentifier}: ${p.issueTitle}\nAgent: ${p.agentName}\nError: ${p.error}\nAttempt ${p.attempt}/${p.maxRetries}`,

  "agent.escalation": (p) =>
    `<b>Agent escalated</b>\nAgent ${p.agentName} needs help with #${p.issueIdentifier}\nReason: ${p.reason}`,

  "agent.budget_warning": (p) =>
    `<b>Budget warning</b>\nAgent ${p.agentName} at ${p.percentUsed}% of monthly budget\n$${(p.spentCents / 100).toFixed(2)} / $${(p.budgetCents / 100).toFixed(2)}`,

  "agent.review_pending": (p) =>
    `<b>Review needed</b>\n#${p.issueIdentifier}: ${p.issueTitle}\nAgent: ${p.agentName}`,

  "agent.circuit_breaker": (p) =>
    `<b>Circuit breaker tripped</b>\nAgent ${p.agentName} auto-paused\nFailed on ${p.failedTaskCount}+ tasks in 24h`,
};

/** Strip HTML tags for Discord embeds */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

/** Format message for a specific channel type */
function formatMessage(
  channelType: string,
  eventType: string,
  payload: Record<string, unknown>,
): string {
  const formatter = formatters[eventType];
  if (!formatter) {
    // Fallback: simple JSON summary
    return `[${eventType}] ${JSON.stringify(payload)}`;
  }
  const html = formatter(payload);
  if (channelType === "discord") {
    return stripHtml(html);
  }
  return html;
}

/* ------------------------------------------------------------------ */
/*  Inline keyboard builders (Telegram only)                          */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };

function buildInlineKeyboard(
  eventType: string,
  payload: Record<string, unknown>,
): InlineKeyboard | undefined {
  switch (eventType) {
    case "task.failed":
      return {
        inline_keyboard: [[
          { text: "Retry", callback_data: `action:retry:${payload.issueId}` },
          { text: "Pause Agent", callback_data: `action:pause_agent:${payload.agentId}` },
        ]],
      };
    case "agent.review_pending":
      return {
        inline_keyboard: [[
          { text: "Approve", callback_data: `action:approve:${payload.issueId}` },
          { text: "Reject", callback_data: `action:reject:${payload.issueId}` },
        ]],
      };
    case "agent.budget_warning":
      return {
        inline_keyboard: [[
          { text: "Pause Agent", callback_data: `action:pause_agent:${payload.agentId}` },
        ]],
      };
    case "agent.circuit_breaker":
      return {
        inline_keyboard: [[
          { text: "Resume Agent", callback_data: `action:resume_agent:${payload.agentId}` },
        ]],
      };
    default:
      return undefined;
  }
}

/** Check if a rule's filter matches the payload */
function matchesFilter(
  filter: Record<string, unknown> | null,
  payload: Record<string, unknown>,
): boolean {
  if (!filter) return true;
  // Each key in the filter must match the corresponding payload value
  for (const [key, value] of Object.entries(filter)) {
    if (payload[key] !== value) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Notification service                                              */
/* ------------------------------------------------------------------ */

export function notificationService(db: Db) {
  return {
    /**
     * Emit a notification event. Fire-and-forget — logs errors but never throws.
     */
    async emit(
      companyId: string,
      eventType: string,
      payload: Record<string, unknown>,
    ): Promise<void> {
      try {
        // 1. Find matching rules (enabled, matching eventType, matching companyId)
        const rules = await db
          .select()
          .from(notificationRules)
          .where(
            and(
              eq(notificationRules.companyId, companyId),
              eq(notificationRules.eventType, eventType),
              eq(notificationRules.enabled, true),
            ),
          );

        if (rules.length === 0) return;

        // 2. For each rule, get its channel and dispatch
        for (const rule of rules) {
          try {
            // Check filter
            if (!matchesFilter(rule.filter, payload)) continue;

            // Get channel
            const channel = await db
              .select()
              .from(notificationChannels)
              .where(
                and(
                  eq(notificationChannels.id, rule.channelId),
                  eq(notificationChannels.enabled, true),
                ),
              )
              .then((rows) => rows[0] ?? null);

            if (!channel) continue;

            const config = channel.config as Record<string, unknown>;

            // 3. Format and send via appropriate sender
            switch (channel.channelType) {
              case "telegram": {
                const text = formatMessage("telegram", eventType, payload);
                const replyMarkup = buildInlineKeyboard(eventType, payload);
                await sendTelegram(
                  {
                    botToken: config.botToken as string,
                    chatId: config.chatId as string,
                  },
                  text,
                  replyMarkup ? { replyMarkup } : undefined,
                );
                break;
              }
              case "discord": {
                const text = formatMessage("discord", eventType, payload);
                await sendDiscord(
                  { webhookUrl: config.webhookUrl as string },
                  text,
                );
                break;
              }
              case "webhook": {
                await sendWebhook(
                  {
                    url: config.url as string,
                    secret: config.secret as string | undefined,
                  },
                  { eventType, payload, timestamp: new Date().toISOString() },
                );
                break;
              }
              default:
                logger.warn(
                  { channelType: channel.channelType, channelId: channel.id },
                  "unknown notification channel type",
                );
            }
          } catch (err) {
            logger.warn(
              { err, ruleId: rule.id, eventType },
              "notification send failed for rule",
            );
          }
        }
      } catch (err) {
        logger.warn(
          { err, companyId, eventType },
          "notification emit failed",
        );
      }
    },
  };
}
