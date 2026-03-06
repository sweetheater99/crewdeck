import { Router } from "express";
import type { Db } from "@crewdeck/db";
import { metricsService } from "../services/metrics.js";
import { assertCompanyAccess } from "./authz.js";

export function metricsRoutes(db: Db) {
  const router = Router();
  const svc = metricsService(db);

  function parseDateRange(query: Record<string, unknown>) {
    const from = query.from ? new Date(query.from as string) : undefined;
    const to = query.to ? new Date(query.to as string) : undefined;
    return from || to ? { from, to } : undefined;
  }

  router.get("/companies/:companyId/metrics/overview", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const range = parseDateRange(req.query);
    const overview = await svc.overview(companyId, range);
    res.json(overview);
  });

  router.get("/companies/:companyId/metrics/agents", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const range = parseDateRange(req.query);
    const scorecard = await svc.agentScorecard(companyId, range);
    res.json(scorecard);
  });

  router.get("/companies/:companyId/metrics/trends", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const period = req.query.period === "30d" ? "30d" : "7d";
    const trends = await svc.trends(companyId, period);
    res.json(trends);
  });

  return router;
}
