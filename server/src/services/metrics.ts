import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@crewdeck/db";
import { agents, companies, costEvents, heartbeatRuns, issues } from "@crewdeck/db";
import { notFound } from "../errors.js";

export interface MetricsDateRange {
  from?: Date;
  to?: Date;
}

export function metricsService(db: Db) {
  return {
    /**
     * High-level overview: spend, budget, task counts, agent counts.
     */
    overview: async (companyId: string, dateRange?: MetricsDateRange) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      // Cost aggregation
      const costConditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (dateRange?.from) costConditions.push(gte(costEvents.occurredAt, dateRange.from));
      if (dateRange?.to) costConditions.push(lte(costEvents.occurredAt, dateRange.to));

      const [{ totalSpend }] = await db
        .select({
          totalSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(...costConditions));

      // Issue counts by status
      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      let tasksCompleted = 0;
      let tasksFailed = 0;
      let tasksInProgress = 0;
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "done") tasksCompleted += count;
        else if (row.status === "cancelled") tasksFailed += count;
        else if (row.status === "in_progress") tasksInProgress += count;
      }

      // Agent counts by status
      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      let activeAgents = 0;
      let idleAgents = 0;
      let pausedAgents = 0;
      for (const row of agentRows) {
        const count = Number(row.count);
        if (row.status === "running") activeAgents += count;
        else if (row.status === "idle") idleAgents += count;
        else if (row.status === "paused") pausedAgents += count;
      }

      return {
        totalSpendCents: Number(totalSpend),
        budgetCents: company.budgetMonthlyCents,
        tasksCompleted,
        tasksFailed,
        tasksInProgress,
        activeAgents,
        idleAgents,
        pausedAgents,
      };
    },

    /**
     * Per-agent scorecard: tasks, success rate, avg duration, cost.
     */
    agentScorecard: async (companyId: string, dateRange?: MetricsDateRange) => {
      // Get all agents for the company
      const agentList = await db
        .select({
          id: agents.id,
          name: agents.name,
          status: agents.status,
          consecutiveFailures: agents.consecutiveFailures,
        })
        .from(agents)
        .where(eq(agents.companyId, companyId));

      if (agentList.length === 0) return [];

      // Heartbeat run aggregations per agent
      const runConditions: ReturnType<typeof eq>[] = [eq(heartbeatRuns.companyId, companyId)];
      if (dateRange?.from) runConditions.push(gte(heartbeatRuns.startedAt, dateRange.from));
      if (dateRange?.to) runConditions.push(lte(heartbeatRuns.startedAt, dateRange.to));

      const runRows = await db
        .select({
          agentId: heartbeatRuns.agentId,
          succeeded: sql<number>`coalesce(sum(case when ${heartbeatRuns.status} = 'succeeded' then 1 else 0 end), 0)::int`,
          failed: sql<number>`coalesce(sum(case when ${heartbeatRuns.status} = 'failed' then 1 else 0 end), 0)::int`,
          avgDurationMinutes: sql<number>`coalesce(avg(extract(epoch from (${heartbeatRuns.finishedAt} - ${heartbeatRuns.startedAt})) / 60.0), 0)`,
        })
        .from(heartbeatRuns)
        .where(and(...runConditions))
        .groupBy(heartbeatRuns.agentId);

      const runMap = new Map(runRows.map((r) => [r.agentId, r]));

      // Cost aggregation per agent
      const costConditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (dateRange?.from) costConditions.push(gte(costEvents.occurredAt, dateRange.from));
      if (dateRange?.to) costConditions.push(lte(costEvents.occurredAt, dateRange.to));

      const costRows = await db
        .select({
          agentId: costEvents.agentId,
          totalCostCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(...costConditions))
        .groupBy(costEvents.agentId);

      const costMap = new Map(costRows.map((r) => [r.agentId, r]));

      return agentList.map((agent) => {
        const runs = runMap.get(agent.id);
        const costs = costMap.get(agent.id);
        const succeeded = Number(runs?.succeeded ?? 0);
        const failed = Number(runs?.failed ?? 0);
        const total = succeeded + failed;
        const totalCostCents = Number(costs?.totalCostCents ?? 0);

        return {
          agentId: agent.id,
          name: agent.name,
          tasksCompleted: succeeded,
          tasksFailed: failed,
          successRate: total > 0 ? Number(((succeeded / total) * 100).toFixed(2)) : 0,
          avgDurationMinutes: Number(Number(runs?.avgDurationMinutes ?? 0).toFixed(2)),
          totalCostCents,
          costPerTaskCents: total > 0 ? Number((totalCostCents / total).toFixed(2)) : 0,
          consecutiveFailures: agent.consecutiveFailures,
          status: agent.status,
        };
      });
    },

    /**
     * Daily trends for spend and task counts over 7d or 30d.
     */
    trends: async (companyId: string, period: "7d" | "30d" = "7d") => {
      const days = period === "7d" ? 7 : 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Daily spend from cost_events
      const costDaily = await db
        .select({
          date: sql<string>`to_char(${costEvents.occurredAt}::date, 'YYYY-MM-DD')`,
          spendCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, since),
          ),
        )
        .groupBy(sql`${costEvents.occurredAt}::date`)
        .orderBy(sql`${costEvents.occurredAt}::date`);

      // Daily run counts from heartbeat_runs
      const runDaily = await db
        .select({
          date: sql<string>`to_char(${heartbeatRuns.startedAt}::date, 'YYYY-MM-DD')`,
          runsTotal: sql<number>`count(*)::int`,
          tasksCompleted: sql<number>`coalesce(sum(case when ${heartbeatRuns.status} = 'succeeded' then 1 else 0 end), 0)::int`,
          tasksFailed: sql<number>`coalesce(sum(case when ${heartbeatRuns.status} = 'failed' then 1 else 0 end), 0)::int`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            gte(heartbeatRuns.startedAt, since),
          ),
        )
        .groupBy(sql`${heartbeatRuns.startedAt}::date`)
        .orderBy(sql`${heartbeatRuns.startedAt}::date`);

      // Merge into a single daily array
      const costMap = new Map(costDaily.map((r) => [r.date, Number(r.spendCents)]));
      const runMap = new Map(
        runDaily.map((r) => [
          r.date,
          {
            runsTotal: Number(r.runsTotal),
            tasksCompleted: Number(r.tasksCompleted),
            tasksFailed: Number(r.tasksFailed),
          },
        ]),
      );

      // Build a complete array for every day in the range
      const daily: Array<{
        date: string;
        spendCents: number;
        tasksCompleted: number;
        tasksFailed: number;
        runsTotal: number;
      }> = [];

      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().slice(0, 10);
        const runs = runMap.get(key);
        daily.push({
          date: key,
          spendCents: costMap.get(key) ?? 0,
          tasksCompleted: runs?.tasksCompleted ?? 0,
          tasksFailed: runs?.tasksFailed ?? 0,
          runsTotal: runs?.runsTotal ?? 0,
        });
      }

      return { daily };
    },
  };
}
