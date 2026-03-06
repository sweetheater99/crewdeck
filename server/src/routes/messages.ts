import { Router } from "express";
import type { Db } from "@crewdeck/db";
import { assertCompanyAccess } from "./authz.js";
import { messageService } from "../services/messages.js";

export function messageRoutes(db: Db) {
  const router = Router();
  const svc = messageService(db);

  /* GET /api/companies/:companyId/messages?agentId=X&issueId=Y */
  router.get("/companies/:companyId/messages", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { agentId, issueId } = req.query as {
      agentId?: string;
      issueId?: string;
    };

    if (issueId) {
      const messages = await svc.listForIssue(companyId, issueId);
      res.json(messages);
      return;
    }
    if (agentId) {
      const messages = await svc.listForAgent(companyId, agentId);
      res.json(messages);
      return;
    }
    res.json([]);
  });

  /* POST /api/companies/:companyId/messages */
  router.post("/companies/:companyId/messages", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { fromAgentId, toAgentId, issueId, content, messageType } = req.body;

    const message = await svc.send(companyId, {
      fromAgentId: fromAgentId ?? null,
      toAgentId: toAgentId ?? null,
      issueId: issueId ?? null,
      content,
      messageType: messageType ?? undefined,
    });

    res.status(201).json(message);
  });

  /* PATCH /api/companies/:companyId/messages/:id/read */
  router.patch("/companies/:companyId/messages/:id/read", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const messageId = req.params.id as string;
    const updated = await svc.markRead(messageId);

    res.json(updated);
  });

  return router;
}
