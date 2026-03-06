import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@crewdeck/db";
import { issues, agents } from "@crewdeck/db";
import { agentService } from "../services/agents.js";
import { issueService } from "../services/issues.js";
import { heartbeatService } from "../services/heartbeat.js";
import { logger } from "../middleware/logger.js";

/* ------------------------------------------------------------------ */
/*  Telegram callback query handler                                   */
/* ------------------------------------------------------------------ */

/**
 * Answers a Telegram callback query (removes the "loading" spinner on the button).
 */
async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text ?? "Done",
    }),
  }).catch((err) => logger.warn({ err }, "answerCallbackQuery failed"));
}

/**
 * Removes inline keyboard from the original message.
 */
async function removeInlineKeyboard(
  botToken: string,
  chatId: number | string,
  messageId: number,
  actionText: string,
): Promise<void> {
  // Edit the reply markup to remove buttons
  const url = `https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: JSON.stringify({ inline_keyboard: [] }),
    }),
  }).catch((err) => logger.warn({ err }, "editMessageReplyMarkup failed"));

  // Send a short confirmation reply
  const sendUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await fetch(sendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: actionText,
      reply_to_message_id: messageId,
      parse_mode: "HTML",
    }),
  }).catch((err) => logger.warn({ err }, "sendMessage (confirmation) failed"));
}

/**
 * Resolve the bot token for the company that owns an issue or agent.
 * We look up the notification channels for the company and find a Telegram channel.
 * Returns null if none found.
 */
async function resolveBotToken(
  db: Db,
  companyId: string,
): Promise<string | null> {
  const { notificationChannels } = await import("@crewdeck/db");
  const channels = await db
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.companyId, companyId));

  for (const ch of channels) {
    if (ch.channelType === "telegram") {
      const config = ch.config as Record<string, unknown>;
      if (config.botToken) return config.botToken as string;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Route                                                             */
/* ------------------------------------------------------------------ */

export function notificationCallbackRoutes(db: Db) {
  const router = Router();
  const agentsSvc = agentService(db);
  const issueSvc = issueService(db);
  const heartbeat = heartbeatService(db);

  /**
   * POST /api/notifications/telegram/callback
   *
   * Telegram sends callback_query updates here when a user taps an inline button.
   */
  router.post("/notifications/telegram/callback", async (req, res) => {
    try {
      const callbackQuery = req.body?.callback_query;
      if (!callbackQuery) {
        // Not a callback_query update — ignore silently
        res.json({ ok: true });
        return;
      }

      const callbackQueryId: string = callbackQuery.id;
      const data: string | undefined = callbackQuery.data;
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;

      if (!data) {
        res.json({ ok: true });
        return;
      }

      // Parse: "action:<type>:<entityId>"
      const parts = data.split(":");
      if (parts.length < 3 || parts[0] !== "action") {
        res.json({ ok: true });
        return;
      }

      const actionType = parts[1];
      const entityId = parts.slice(2).join(":"); // UUIDs don't have colons, but be safe

      let resultText = "Done";
      let confirmationText = "";

      switch (actionType) {
        case "retry": {
          // Re-wake the assigned agent for this issue
          const issue = await issueSvc.getById(entityId);
          if (!issue) {
            resultText = "Issue not found";
            break;
          }
          if (!issue.assigneeAgentId) {
            resultText = "No agent assigned";
            break;
          }
          await heartbeat.wakeup(issue.assigneeAgentId, {
            source: "automation",
            triggerDetail: "callback",
            reason: "retry_from_notification",
            contextSnapshot: { issueId: entityId },
          });
          resultText = "Retry queued";
          confirmationText = `<b>Action taken:</b> Retry queued for #${issue.identifier}`;
          break;
        }

        case "approve": {
          const issue = await issueSvc.getById(entityId);
          if (!issue) {
            resultText = "Issue not found";
            break;
          }
          if (issue.reviewStatus !== "pending_review") {
            resultText = "Issue is not pending review";
            break;
          }
          // Set reviewStatus = approved and mark as done
          await db
            .update(issues)
            .set({ reviewStatus: "approved", updatedAt: new Date() })
            .where(eq(issues.id, entityId));
          await issueSvc.update(entityId, { status: "done" as Parameters<typeof issueSvc.update>[1]["status"] });
          resultText = "Approved";
          confirmationText = `<b>Action taken:</b> #${issue.identifier} approved`;
          break;
        }

        case "reject": {
          const issue = await issueSvc.getById(entityId);
          if (!issue) {
            resultText = "Issue not found";
            break;
          }
          if (issue.reviewStatus !== "pending_review") {
            resultText = "Issue is not pending review";
            break;
          }
          // Reject with no feedback (simple v1)
          await db
            .update(issues)
            .set({ reviewStatus: "rejected", updatedAt: new Date() })
            .where(eq(issues.id, entityId));
          // Re-wake the assigned agent
          if (issue.assigneeAgentId) {
            void heartbeat
              .wakeup(issue.assigneeAgentId, {
                source: "automation",
                triggerDetail: "callback",
                reason: "review_rejected",
                contextSnapshot: {
                  issueId: entityId,
                  wakeReason: "review_rejected",
                  wakeSource: "automation",
                  rejectionFeedback: null,
                },
              })
              .catch((err) =>
                logger.warn({ err, entityId }, "failed to wake agent on rejection from callback"),
              );
          }
          resultText = "Rejected";
          confirmationText = `<b>Action taken:</b> #${issue.identifier} rejected`;
          break;
        }

        case "pause_agent": {
          const agent = await agentsSvc.getById(entityId);
          if (!agent) {
            resultText = "Agent not found";
            break;
          }
          await agentsSvc.pause(entityId);
          resultText = "Agent paused";
          confirmationText = `<b>Action taken:</b> ${agent.name} paused`;
          break;
        }

        case "resume_agent": {
          const agent = await agentsSvc.getById(entityId);
          if (!agent) {
            resultText = "Agent not found";
            break;
          }
          await agentsSvc.resume(entityId);
          resultText = "Agent resumed";
          confirmationText = `<b>Action taken:</b> ${agent.name} resumed`;
          break;
        }

        default:
          resultText = `Unknown action: ${actionType}`;
      }

      // Look up bot token from the entity's company
      let botToken: string | null = null;
      if (confirmationText && chatId && messageId) {
        try {
          let companyId: string | null = null;
          if (["retry", "approve", "reject"].includes(actionType)) {
            const issue = await issueSvc.getById(entityId);
            companyId = issue?.companyId ?? null;
          } else if (["pause_agent", "resume_agent"].includes(actionType)) {
            const agent = await agentsSvc.getById(entityId);
            companyId = agent?.companyId ?? null;
          }
          if (companyId) {
            botToken = await resolveBotToken(db, companyId);
          }
        } catch (err) {
          logger.warn({ err }, "failed to resolve bot token for callback confirmation");
        }
      }

      if (botToken) {
        await answerCallbackQuery(botToken, callbackQueryId, resultText);
        if (confirmationText && chatId && messageId) {
          await removeInlineKeyboard(botToken, chatId, messageId, confirmationText);
        }
      }

      res.json({ ok: true });
    } catch (err) {
      logger.warn({ err }, "notification callback handler error");
      // Always return 200 to Telegram to prevent retries
      res.json({ ok: true });
    }
  });

  return router;
}
