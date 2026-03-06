import { Router } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@crewdeck/db";
import { notificationChannels, notificationRules } from "@crewdeck/db";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { sendTelegram } from "../services/notification-senders/telegram.js";
import { sendDiscord } from "../services/notification-senders/discord.js";
import { sendWebhook } from "../services/notification-senders/webhook.js";

export function notificationRoutes(db: Db) {
  const router = Router();

  /* ------------------------------------------------------------------ */
  /*  Channels                                                          */
  /* ------------------------------------------------------------------ */

  router.get("/companies/:companyId/notifications/channels", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const channels = await db
      .select()
      .from(notificationChannels)
      .where(eq(notificationChannels.companyId, companyId));

    res.json(channels);
  });

  router.post("/companies/:companyId/notifications/channels", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { channelType, label, config, enabled, digestEnabled, digestTime, digestTimezone } =
      req.body;

    const [created] = await db
      .insert(notificationChannels)
      .values({
        companyId,
        channelType,
        label: label ?? null,
        config: config ?? {},
        enabled: enabled ?? true,
        digestEnabled: digestEnabled ?? false,
        digestTime: digestTime ?? null,
        digestTimezone: digestTimezone ?? null,
      })
      .returning();

    res.status(201).json(created);
  });

  router.patch("/companies/:companyId/notifications/channels/:id", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const id = req.params.id as string;

    const existing = await db
      .select()
      .from(notificationChannels)
      .where(
        and(eq(notificationChannels.id, id), eq(notificationChannels.companyId, companyId)),
      )
      .then((rows) => rows[0] ?? null);

    if (!existing) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body.channelType !== undefined) updates.channelType = req.body.channelType;
    if (req.body.label !== undefined) updates.label = req.body.label;
    if (req.body.config !== undefined) updates.config = req.body.config;
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.digestEnabled !== undefined) updates.digestEnabled = req.body.digestEnabled;
    if (req.body.digestTime !== undefined) updates.digestTime = req.body.digestTime;
    if (req.body.digestTimezone !== undefined) updates.digestTimezone = req.body.digestTimezone;

    const [updated] = await db
      .update(notificationChannels)
      .set(updates)
      .where(
        and(eq(notificationChannels.id, id), eq(notificationChannels.companyId, companyId)),
      )
      .returning();

    res.json(updated);
  });

  router.delete("/companies/:companyId/notifications/channels/:id", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const id = req.params.id as string;

    const existing = await db
      .select()
      .from(notificationChannels)
      .where(
        and(eq(notificationChannels.id, id), eq(notificationChannels.companyId, companyId)),
      )
      .then((rows) => rows[0] ?? null);

    if (!existing) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    await db
      .delete(notificationChannels)
      .where(
        and(eq(notificationChannels.id, id), eq(notificationChannels.companyId, companyId)),
      );

    res.json({ ok: true });
  });

  router.post("/companies/:companyId/notifications/channels/:id/test", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const id = req.params.id as string;

    const channel = await db
      .select()
      .from(notificationChannels)
      .where(
        and(eq(notificationChannels.id, id), eq(notificationChannels.companyId, companyId)),
      )
      .then((rows) => rows[0] ?? null);

    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const config = channel.config as Record<string, unknown>;
    const testMsg = `CrewDeck test notification\nChannel: ${channel.label ?? channel.channelType}\nTime: ${new Date().toISOString()}`;

    try {
      switch (channel.channelType) {
        case "telegram":
          await sendTelegram(
            { botToken: config.botToken as string, chatId: config.chatId as string },
            testMsg,
          );
          break;
        case "discord":
          await sendDiscord({ webhookUrl: config.webhookUrl as string }, testMsg);
          break;
        case "webhook":
          await sendWebhook(
            { url: config.url as string, secret: config.secret as string | undefined },
            { eventType: "test", payload: { message: testMsg }, timestamp: new Date().toISOString() },
          );
          break;
        default:
          res.status(400).json({ error: `Unknown channel type: ${channel.channelType}` });
          return;
      }
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Send failed";
      res.status(502).json({ error: message });
    }
  });

  /* ------------------------------------------------------------------ */
  /*  Rules                                                             */
  /* ------------------------------------------------------------------ */

  router.get("/companies/:companyId/notifications/rules", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const rules = await db
      .select()
      .from(notificationRules)
      .where(eq(notificationRules.companyId, companyId));

    res.json(rules);
  });

  router.post("/companies/:companyId/notifications/rules", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { channelId, eventType, filter, enabled } = req.body;

    // Verify channel exists and belongs to this company
    const channel = await db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.id, channelId),
          eq(notificationChannels.companyId, companyId),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!channel) {
      res.status(400).json({ error: "Channel not found" });
      return;
    }

    const [created] = await db
      .insert(notificationRules)
      .values({
        companyId,
        channelId,
        eventType,
        filter: filter ?? null,
        enabled: enabled ?? true,
      })
      .returning();

    res.status(201).json(created);
  });

  router.patch("/companies/:companyId/notifications/rules/:id", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const id = req.params.id as string;

    const existing = await db
      .select()
      .from(notificationRules)
      .where(
        and(eq(notificationRules.id, id), eq(notificationRules.companyId, companyId)),
      )
      .then((rows) => rows[0] ?? null);

    if (!existing) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body.channelId !== undefined) updates.channelId = req.body.channelId;
    if (req.body.eventType !== undefined) updates.eventType = req.body.eventType;
    if (req.body.filter !== undefined) updates.filter = req.body.filter;
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;

    const [updated] = await db
      .update(notificationRules)
      .set(updates)
      .where(
        and(eq(notificationRules.id, id), eq(notificationRules.companyId, companyId)),
      )
      .returning();

    res.json(updated);
  });

  router.delete("/companies/:companyId/notifications/rules/:id", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const id = req.params.id as string;

    const existing = await db
      .select()
      .from(notificationRules)
      .where(
        and(eq(notificationRules.id, id), eq(notificationRules.companyId, companyId)),
      )
      .then((rows) => rows[0] ?? null);

    if (!existing) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    await db
      .delete(notificationRules)
      .where(
        and(eq(notificationRules.id, id), eq(notificationRules.companyId, companyId)),
      );

    res.json({ ok: true });
  });

  return router;
}
