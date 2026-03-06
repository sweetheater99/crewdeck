import { Router } from "express";
import type { Db } from "@crewdeck/db";
import { createKnowledgeEntrySchema, updateKnowledgeEntrySchema } from "@crewdeck/shared";
import { validate } from "../middleware/validate.js";
import { knowledgeService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

export function knowledgeRoutes(db: Db) {
  const router = Router();
  const svc = knowledgeService(db);

  router.get("/companies/:companyId/knowledge", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const projectId = req.query.projectId as string | undefined;
    const query = (req.query.q as string | undefined) || undefined;
    const tagsParam = req.query.tags as string | undefined;
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : undefined;

    const results = await svc.search(companyId, { projectId, query, tags });
    res.json(results);
  });

  router.post("/companies/:companyId/knowledge", validate(createKnowledgeEntrySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const entry = await svc.create(companyId, req.body);
    res.status(201).json(entry);
  });

  router.get("/companies/:companyId/knowledge/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    const id = req.params.id as string;
    assertCompanyAccess(req, companyId);
    const entry = await svc.getById(companyId, id);
    if (!entry) {
      res.status(404).json({ error: "Knowledge entry not found" });
      return;
    }
    res.json(entry);
  });

  router.patch("/companies/:companyId/knowledge/:id", validate(updateKnowledgeEntrySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    const id = req.params.id as string;
    assertCompanyAccess(req, companyId);
    const entry = await svc.update(companyId, id, req.body);
    res.json(entry);
  });

  router.delete("/companies/:companyId/knowledge/:id", async (req, res) => {
    const companyId = req.params.companyId as string;
    const id = req.params.id as string;
    assertCompanyAccess(req, companyId);
    const entry = await svc.remove(companyId, id);
    res.json(entry);
  });

  return router;
}
