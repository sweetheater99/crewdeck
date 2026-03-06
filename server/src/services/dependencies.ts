import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@crewdeck/db";
import { issueDependencies, issues } from "@crewdeck/db";
import { unprocessable, notFound } from "../errors.js";

const DONE_STATUSES = new Set(["done", "cancelled"]);

export interface DependencyServiceOptions {
  /** Called when a blocked issue becomes unblocked and has an assigned agent. */
  onUnblocked?: (companyId: string, issueId: string, agentId: string) => void | Promise<void>;
}

export function dependencyService(db: Db, opts: DependencyServiceOptions = {}) {
  async function recalculateBlockedStatus(companyId: string, issueId: string) {
    // Fetch the issue
    const issue = await db
      .select({
        id: issues.id,
        status: issues.status,
        assigneeAgentId: issues.assigneeAgentId,
      })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)))
      .then((rows) => rows[0] ?? null);

    if (!issue) return;

    // Don't touch issues that are already done or cancelled
    if (DONE_STATUSES.has(issue.status)) return;

    // Find all dependencies and their statuses
    const deps = await db
      .select({
        dependsOnId: issueDependencies.dependsOnId,
        dependsOnStatus: issues.status,
      })
      .from(issueDependencies)
      .innerJoin(issues, eq(issueDependencies.dependsOnId, issues.id))
      .where(
        and(
          eq(issueDependencies.issueId, issueId),
          eq(issueDependencies.companyId, companyId),
        ),
      );

    const hasUnfinishedDeps = deps.some((d) => !DONE_STATUSES.has(d.dependsOnStatus));

    if (hasUnfinishedDeps && issue.status !== "blocked") {
      // Block the issue
      await db
        .update(issues)
        .set({ status: "blocked", updatedAt: new Date() })
        .where(eq(issues.id, issueId));
    } else if (!hasUnfinishedDeps && issue.status === "blocked") {
      // Unblock: set to in_progress if agent assigned, else backlog
      const nextStatus = issue.assigneeAgentId ? "in_progress" : "backlog";
      await db
        .update(issues)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(issues.id, issueId));

      // Auto-wake the assigned agent now that this issue is unblocked
      if (issue.assigneeAgentId && opts.onUnblocked) {
        void Promise.resolve(opts.onUnblocked(companyId, issueId, issue.assigneeAgentId)).catch(() => {});
      }
    }
  }

  return {
    addDependency: async (companyId: string, issueId: string, dependsOnId: string) => {
      // Self-reference check
      if (issueId === dependsOnId) {
        throw unprocessable("An issue cannot depend on itself");
      }

      // Verify both issues exist and belong to this company
      const [issue, dependsOn] = await Promise.all([
        db
          .select({ id: issues.id })
          .from(issues)
          .where(and(eq(issues.id, issueId), eq(issues.companyId, companyId)))
          .then((rows) => rows[0] ?? null),
        db
          .select({ id: issues.id })
          .from(issues)
          .where(and(eq(issues.id, dependsOnId), eq(issues.companyId, companyId)))
          .then((rows) => rows[0] ?? null),
      ]);

      if (!issue) throw notFound("Issue not found");
      if (!dependsOn) throw notFound("Dependency issue not found");

      // Cycle detection via recursive CTE
      const cycleCheck = await db.execute(sql`
        WITH RECURSIVE dep_chain AS (
          SELECT depends_on_id AS id FROM issue_dependencies
          WHERE issue_id = ${dependsOnId} AND company_id = ${companyId}
          UNION ALL
          SELECT d.depends_on_id FROM issue_dependencies d
          JOIN dep_chain c ON d.issue_id = c.id
          WHERE d.company_id = ${companyId}
        )
        SELECT 1 FROM dep_chain WHERE id = ${issueId} LIMIT 1
      `);

      if (cycleCheck.length > 0) {
        throw unprocessable("Adding this dependency would create a cycle");
      }

      const [row] = await db
        .insert(issueDependencies)
        .values({ companyId, issueId, dependsOnId })
        .onConflictDoNothing()
        .returning();

      // Recalculate blocked status for the issue that now has a new dependency
      await recalculateBlockedStatus(companyId, issueId);

      return row ?? null;
    },

    removeDependency: async (companyId: string, issueId: string, dependsOnId: string) => {
      const [removed] = await db
        .delete(issueDependencies)
        .where(
          and(
            eq(issueDependencies.companyId, companyId),
            eq(issueDependencies.issueId, issueId),
            eq(issueDependencies.dependsOnId, dependsOnId),
          ),
        )
        .returning();

      if (!removed) throw notFound("Dependency not found");

      // Recalculate blocked status after removing a dependency
      await recalculateBlockedStatus(companyId, issueId);

      return removed;
    },

    getDependencies: async (companyId: string, issueId: string) => {
      return db
        .select({
          id: issueDependencies.id,
          dependsOnId: issueDependencies.dependsOnId,
          title: issues.title,
          status: issues.status,
          identifier: issues.identifier,
          createdAt: issueDependencies.createdAt,
        })
        .from(issueDependencies)
        .innerJoin(issues, eq(issueDependencies.dependsOnId, issues.id))
        .where(
          and(
            eq(issueDependencies.issueId, issueId),
            eq(issueDependencies.companyId, companyId),
          ),
        );
    },

    getDependents: async (companyId: string, issueId: string) => {
      return db
        .select({
          id: issueDependencies.id,
          issueId: issueDependencies.issueId,
          title: issues.title,
          status: issues.status,
          identifier: issues.identifier,
          createdAt: issueDependencies.createdAt,
        })
        .from(issueDependencies)
        .innerJoin(issues, eq(issueDependencies.issueId, issues.id))
        .where(
          and(
            eq(issueDependencies.dependsOnId, issueId),
            eq(issueDependencies.companyId, companyId),
          ),
        );
    },

    recalculateBlockedStatus,

    onIssueCompleted: async (companyId: string, completedIssueId: string) => {
      // Find all dependents of the completed issue
      const dependents = await db
        .select({ issueId: issueDependencies.issueId })
        .from(issueDependencies)
        .where(
          and(
            eq(issueDependencies.dependsOnId, completedIssueId),
            eq(issueDependencies.companyId, companyId),
          ),
        );

      // Recalculate blocked status for each dependent
      for (const dep of dependents) {
        await recalculateBlockedStatus(companyId, dep.issueId);
      }
    },
  };
}
