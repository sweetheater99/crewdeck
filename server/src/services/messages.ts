import { and, eq, or, asc, isNull } from "drizzle-orm";
import type { Db } from "@crewdeck/db";
import { agentMessages, agents } from "@crewdeck/db";
import { notFound } from "../errors.js";
import { notificationService } from "./notifications.js";
import { heartbeatService } from "./heartbeat.js";
import { logger } from "../middleware/logger.js";

export function messageService(db: Db) {
  const notifSvc = notificationService(db);
  const heartbeat = heartbeatService(db);

  return {
    async send(
      companyId: string,
      input: {
        fromAgentId?: string | null;
        toAgentId?: string | null;
        issueId?: string | null;
        content: string;
        messageType?: string;
      },
    ) {
      const [message] = await db
        .insert(agentMessages)
        .values({
          companyId,
          fromAgentId: input.fromAgentId ?? null,
          toAgentId: input.toAgentId ?? null,
          issueId: input.issueId ?? null,
          content: input.content,
          messageType: input.messageType ?? "message",
        })
        .returning();

      // If directed to a specific agent, enqueue a wakeup
      if (input.toAgentId) {
        void heartbeat
          .wakeup(input.toAgentId, {
            source: "automation",
            triggerDetail: "system",
            reason: "message_received",
            requestedByActorType: "system",
            requestedByActorId: input.fromAgentId ?? "message_service",
            contextSnapshot: {
              issueId: input.issueId ?? undefined,
              messageId: message.id,
              messageContent: input.content,
              wakeReason: "message_received",
              wakeSource: "automation",
            },
          })
          .catch((err) =>
            logger.warn(
              { err, toAgentId: input.toAgentId, messageId: message.id },
              "failed to wake agent on message_received",
            ),
          );
      }

      // If no target agent (escalation to owner), emit notification
      if (!input.toAgentId) {
        notifSvc
          .emit(companyId, "agent.message", {
            fromAgentId: input.fromAgentId,
            issueId: input.issueId,
            content: input.content,
            messageType: input.messageType ?? "message",
          })
          .catch(() => {});
      }

      return message;
    },

    async listForIssue(
      companyId: string,
      issueId: string,
      _opts?: Record<string, unknown>,
    ) {
      const fromAgent = db
        .$with("from_agent")
        .as(db.select({ id: agents.id, name: agents.name }).from(agents));

      return db
        .select({
          id: agentMessages.id,
          companyId: agentMessages.companyId,
          issueId: agentMessages.issueId,
          fromAgentId: agentMessages.fromAgentId,
          toAgentId: agentMessages.toAgentId,
          content: agentMessages.content,
          messageType: agentMessages.messageType,
          readAt: agentMessages.readAt,
          createdAt: agentMessages.createdAt,
          fromAgentName: agents.name,
        })
        .from(agentMessages)
        .leftJoin(agents, eq(agentMessages.fromAgentId, agents.id))
        .where(
          and(
            eq(agentMessages.companyId, companyId),
            eq(agentMessages.issueId, issueId),
          ),
        )
        .orderBy(asc(agentMessages.createdAt));
    },

    async listForAgent(
      companyId: string,
      agentId: string,
      _opts?: Record<string, unknown>,
    ) {
      // We need the "other party" name — use a subquery approach
      // Join agents for fromAgentId to get the sender name
      return db
        .select({
          id: agentMessages.id,
          companyId: agentMessages.companyId,
          issueId: agentMessages.issueId,
          fromAgentId: agentMessages.fromAgentId,
          toAgentId: agentMessages.toAgentId,
          content: agentMessages.content,
          messageType: agentMessages.messageType,
          readAt: agentMessages.readAt,
          createdAt: agentMessages.createdAt,
          fromAgentName: agents.name,
        })
        .from(agentMessages)
        .leftJoin(agents, eq(agentMessages.fromAgentId, agents.id))
        .where(
          and(
            eq(agentMessages.companyId, companyId),
            or(
              eq(agentMessages.fromAgentId, agentId),
              eq(agentMessages.toAgentId, agentId),
            ),
          ),
        )
        .orderBy(asc(agentMessages.createdAt));
    },

    async listUnread(companyId: string, agentId: string) {
      return db
        .select({
          id: agentMessages.id,
          companyId: agentMessages.companyId,
          issueId: agentMessages.issueId,
          fromAgentId: agentMessages.fromAgentId,
          toAgentId: agentMessages.toAgentId,
          content: agentMessages.content,
          messageType: agentMessages.messageType,
          readAt: agentMessages.readAt,
          createdAt: agentMessages.createdAt,
          fromAgentName: agents.name,
        })
        .from(agentMessages)
        .leftJoin(agents, eq(agentMessages.fromAgentId, agents.id))
        .where(
          and(
            eq(agentMessages.companyId, companyId),
            eq(agentMessages.toAgentId, agentId),
            isNull(agentMessages.readAt),
          ),
        )
        .orderBy(asc(agentMessages.createdAt));
    },

    async markRead(messageId: string) {
      const [updated] = await db
        .update(agentMessages)
        .set({ readAt: new Date() })
        .where(eq(agentMessages.id, messageId))
        .returning();

      if (!updated) throw notFound("Message not found");
      return updated;
    },
  };
}
