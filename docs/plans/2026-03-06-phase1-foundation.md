# Phase 1: Foundation — Rebrand + Core Features

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fork Crewdeck into Crewdeck, add task dependencies, failure escalation, and post-execution review gates.

**Architecture:** Drizzle schema additions (3 new tables, 4 altered tables), Express route handlers, heartbeat service modifications, React UI components. All features bolt onto existing patterns.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, React 19, Vite, Vitest

---

## Task 1: Fork and Rebrand — Package Names and Config

**Files:**
- Modify: `package.json` (root)
- Modify: `cli/package.json`
- Modify: `server/package.json`
- Modify: `ui/package.json`
- Modify: `packages/db/package.json`
- Modify: `packages/shared/package.json`
- Modify: `packages/adapter-utils/package.json`
- Modify: `.npmrc`
- Modify: `pnpm-workspace.yaml`

**Step 1: Update all package.json names**

Replace `@crewdeck/` with `@crewdeck/` in all package.json `name`, `dependencies`, and `devDependencies` fields.

Root `package.json`:
```json
"name": "crewdeck",
```

`cli/package.json`:
```json
"name": "@crewdeck/cli",
"bin": { "crewdeck": "./dist/index.js" },
```

`server/package.json`:
```json
"name": "@crewdeck/server",
```

`ui/package.json`:
```json
"name": "@crewdeck/ui",
```

Update all cross-references in dependencies sections across all package.json files.

**Step 2: Global find-and-replace in source files**

Run across entire repo:
- `@crewdeck/` → `@crewdeck/` (import paths)
- `crewdeck` → `crewdeck` (CLI binary name, npm package name)

```bash
cd ~/crewdeck
grep -rl "@crewdeck/" --include="*.ts" --include="*.tsx" --include="*.json" . | head -50
```

Use sed or IDE refactor to replace all occurrences.

**Step 3: Rename environment variables**

In `server/src/config.ts`:
- `CREWDECK_EMBEDDED_POSTGRES_*` → `CREWDECK_EMBEDDED_POSTGRES_*`
- `CREWDECK_DEPLOYMENT_MODE` → `CREWDECK_DEPLOYMENT_MODE`
- `CREWDECK_SECRETS_PROVIDER` → `CREWDECK_SECRETS_PROVIDER`
- `CREWDECK_STORAGE_PROVIDER` → `CREWDECK_STORAGE_PROVIDER`
- `CREWDECK_AGENT_JWT_SECRET` → `CREWDECK_AGENT_JWT_SECRET`
- `CREWDECK_OPEN_ON_LISTEN` → `CREWDECK_OPEN_ON_LISTEN`

Also update:
- `.env.example`
- `docker-compose.yml`
- `docker-compose.quickstart.yml`
- `Dockerfile`
- All references in `server/src/index.ts`
- All references in `cli/src/commands/*.ts`

**Step 4: Update config paths**

In `server/src/config.ts` and `cli/src/`:
- `~/.crewdeck/` → `~/.crewdeck/`
- `crewdeck.config.yaml` → `crewdeck.config.yaml`

**Step 5: Update UI branding**

In `ui/index.html`:
- `<title>Crewdeck</title>` → `<title>Crewdeck</title>`

Search all UI components for "Crewdeck" text and replace with "Crewdeck".

**Step 6: Verify build**

```bash
pnpm install
pnpm -r typecheck
pnpm build
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: rebrand Crewdeck to Crewdeck

Rename all packages from @crewdeck/* to @crewdeck/*.
Update env vars CREWDECK_* to CREWDECK_*.
Update config dir ~/.crewdeck/ to ~/.crewdeck/.
Update UI branding and titles.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Rebrand — "Company" → "Project" in UI Labels

**Important:** This is a UI/UX label change only. We do NOT rename database columns or API paths in this task. The DB still uses `company_id` internally — we just change what the user sees.

**Files:**
- Modify: `ui/src/components/Sidebar.tsx` — change "Companies" nav label to "Projects"
- Modify: `ui/src/components/CompanyRail.tsx` — change tooltip/labels to "Projects"
- Modify: `ui/src/pages/CompanySettings.tsx` (or equivalent) — "Company Settings" → "Project Settings"
- Modify: `ui/src/pages/Dashboard.tsx` — any "company" text
- Modify: Any component with user-facing "company" / "Company" text

**Step 1: Find all user-facing "company" strings in UI**

```bash
cd ~/crewdeck
grep -rn -i "company\|companies" --include="*.tsx" --include="*.ts" ui/src/ | grep -v "companyId\|company_id\|companyPrefix\|getCompany\|useCompany" | head -40
```

This filters out code identifiers and shows only user-facing strings.

**Step 2: Replace labels**

Replace user-facing strings only:
- "Company" → "Project" (in labels, titles, descriptions, placeholders)
- "Companies" → "Projects"
- "company" → "project" (in UI text like "Select a company")
- Keep all code identifiers as-is (companyId, companyPrefix, etc.)

**Step 3: Update CLI prompts**

In `cli/src/commands/onboard.ts` and other CLI files:
- Change any user-facing prompts that say "company" to "project"

**Step 4: Verify**

```bash
pnpm -r typecheck
pnpm build
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: rebrand Company to Project in user-facing labels

UI labels, CLI prompts, and help text now say Project instead of Company.
Internal code identifiers (companyId, etc.) unchanged.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Strip Enterprise Features from UI

**Files:**
- Modify: `ui/src/pages/` — remove or simplify board claim page
- Modify: `ui/src/components/Sidebar.tsx` — remove governance/approval nav items if overly complex
- Modify: Various UI pages — simplify RBAC-related UI to single-owner model

**Step 1: Identify enterprise-only UI**

Read these files to understand what to strip:
- Board claim page
- Invite system pages
- Complex permission grant UI
- Any "authenticated mode" specific UI that doesn't make sense for a solo founder

**Step 2: Simplify, don't delete**

- Board claim → remove page, keep simple token auth for remote access
- Invites → remove (solo founder doesn't invite others to their dashboard)
- Permission grants UI → remove (owner has all permissions)
- Keep: approvals concept (we're repurposing for review gates)

**Step 3: Verify and commit**

```bash
pnpm -r typecheck && pnpm build
git add -A
git commit -m "chore: strip enterprise governance UI for solo-founder focus

Remove board claim, invite system, complex RBAC UI.
Keep approval system (repurposed for review gates).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Task Dependencies — Schema

**Files:**
- Create: `packages/db/src/schema/issue_dependencies.ts`
- Modify: `packages/db/src/schema/issues.ts` — add `blocked` status
- Modify: `packages/db/src/schema/index.ts` — export new table
- Modify: `packages/shared/src/types/` — add dependency types

**Step 1: Write the schema test**

Create test: `server/src/__tests__/issue-dependencies.test.ts`

```typescript
import { describe, it, expect } from "vitest";

describe("issue dependencies schema", () => {
  it("should define issue_dependencies table with required columns", async () => {
    // This test validates the schema compiles and has correct shape
    const { issueDependencies } = await import("@crewdeck/db/schema");
    expect(issueDependencies).toBeDefined();
    expect(issueDependencies.issueId).toBeDefined();
    expect(issueDependencies.dependsOnId).toBeDefined();
    expect(issueDependencies.companyId).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test:run -- server/src/__tests__/issue-dependencies.test.ts
```

Expected: FAIL — `issueDependencies` not found in schema exports.

**Step 3: Create the schema file**

Create `packages/db/src/schema/issue_dependencies.ts`:

```typescript
import { pgTable, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { issues } from "./issues.js";
import { companies } from "./companies.js";

export const issueDependencies = pgTable(
  "issue_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    unique("uq_issue_dependency").on(table.issueId, table.dependsOnId),
  ]
);
```

**Step 4: Add `blocked` to issue status enum**

In `packages/db/src/schema/issues.ts`, find the status column and add `blocked` to the allowed values.

Also in `packages/shared/src/types/` find the IssueStatus type and add `"blocked"`.

**Step 5: Export from schema index**

In `packages/db/src/schema/index.ts`, add:
```typescript
export * from "./issue_dependencies.js";
```

**Step 6: Generate migration**

```bash
pnpm db:generate
```

This creates a new SQL migration file in `packages/db/src/migrations/`.

**Step 7: Run test to verify it passes**

```bash
pnpm test:run -- server/src/__tests__/issue-dependencies.test.ts
pnpm -r typecheck
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add issue_dependencies schema and blocked status

New junction table for task dependency tracking.
Add 'blocked' to issue status enum.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Task Dependencies — API Routes

**Files:**
- Modify: `server/src/routes/issues.ts` — add dependency CRUD endpoints
- Create: `server/src/services/dependencies.ts` — dependency logic + cycle detection

**Step 1: Write the dependency service test**

Create `server/src/__tests__/dependencies.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("dependency cycle detection", () => {
  it("should detect a direct cycle (A depends on A)", () => {
    const deps = new Map([["A", ["A"]]]);
    expect(hasCycle("A", "A", deps)).toBe(true);
  });

  it("should detect an indirect cycle (A->B->C->A)", () => {
    const deps = new Map([
      ["A", ["B"]],
      ["B", ["C"]],
    ]);
    // Adding C->A would create a cycle
    expect(wouldCreateCycle("C", "A", deps)).toBe(true);
  });

  it("should allow valid dependencies (A->B, A->C)", () => {
    const deps = new Map([["A", ["B"]]]);
    expect(wouldCreateCycle("A", "C", deps)).toBe(false);
  });
});
```

**Step 2: Implement dependency service**

Create `server/src/services/dependencies.ts`:

```typescript
import { eq, and, sql } from "drizzle-orm";
import { issueDependencies, issues } from "@crewdeck/db/schema";
import type { DbClient } from "../db.js";

export function createDependencyService(db: DbClient) {
  return {
    async addDependency(companyId: string, issueId: string, dependsOnId: string) {
      if (issueId === dependsOnId) {
        throw new Error("An issue cannot depend on itself");
      }

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

      if (cycleCheck.rows.length > 0) {
        throw new Error("Adding this dependency would create a cycle");
      }

      await db.insert(issueDependencies).values({
        companyId,
        issueId,
        dependsOnId,
      });

      // Update issue status to blocked if dependency is not done
      await this.recalculateBlockedStatus(companyId, issueId);
    },

    async removeDependency(companyId: string, issueId: string, dependsOnId: string) {
      await db
        .delete(issueDependencies)
        .where(
          and(
            eq(issueDependencies.companyId, companyId),
            eq(issueDependencies.issueId, issueId),
            eq(issueDependencies.dependsOnId, dependsOnId)
          )
        );

      await this.recalculateBlockedStatus(companyId, issueId);
    },

    async getDependencies(companyId: string, issueId: string) {
      return db
        .select()
        .from(issueDependencies)
        .where(
          and(
            eq(issueDependencies.companyId, companyId),
            eq(issueDependencies.issueId, issueId)
          )
        );
    },

    async getDependents(companyId: string, issueId: string) {
      // Issues that depend on this issue
      return db
        .select()
        .from(issueDependencies)
        .where(
          and(
            eq(issueDependencies.companyId, companyId),
            eq(issueDependencies.dependsOnId, issueId)
          )
        );
    },

    async recalculateBlockedStatus(companyId: string, issueId: string) {
      // Check if all dependencies are done
      const unresolved = await db.execute(sql`
        SELECT 1 FROM issue_dependencies d
        JOIN issues i ON i.id = d.depends_on_id
        WHERE d.issue_id = ${issueId}
          AND d.company_id = ${companyId}
          AND i.status != 'done'
        LIMIT 1
      `);

      const isBlocked = unresolved.rows.length > 0;
      const issue = await db.select().from(issues)
        .where(eq(issues.id, issueId)).limit(1);

      if (!issue[0]) return;

      if (isBlocked && issue[0].status !== "blocked" && issue[0].status !== "done") {
        await db.update(issues)
          .set({ status: "blocked" })
          .where(eq(issues.id, issueId));
      } else if (!isBlocked && issue[0].status === "blocked") {
        // Unblock — set back to backlog or in_progress
        const newStatus = issue[0].assigneeAgentId ? "in_progress" : "backlog";
        await db.update(issues)
          .set({ status: newStatus })
          .where(eq(issues.id, issueId));
      }
    },

    async onIssueCompleted(companyId: string, completedIssueId: string) {
      // Find all issues that depended on the completed issue
      const dependents = await this.getDependents(companyId, completedIssueId);

      for (const dep of dependents) {
        await this.recalculateBlockedStatus(companyId, dep.issueId);

        // Check if now unblocked and has agent assigned — auto-wake
        const issue = await db.select().from(issues)
          .where(eq(issues.id, dep.issueId)).limit(1);

        if (issue[0] && issue[0].status === "in_progress" && issue[0].assigneeAgentId) {
          // Import and call enqueueWakeup — will be wired in Task 6
          // enqueueWakeup(issue[0].assigneeAgentId, { source: "dependency_resolved", issueId: dep.issueId })
        }
      }
    },
  };
}
```

**Step 3: Add API routes**

In `server/src/routes/issues.ts`, add these endpoints:

```typescript
// GET /api/companies/:companyId/issues/:issueId/dependencies
router.get("/:issueId/dependencies", async (req, res) => {
  const deps = await dependencyService.getDependencies(req.params.companyId, req.params.issueId);
  res.json(deps);
});

// POST /api/companies/:companyId/issues/:issueId/dependencies
router.post("/:issueId/dependencies", async (req, res) => {
  const { dependsOnId } = req.body;
  await dependencyService.addDependency(req.params.companyId, req.params.issueId, dependsOnId);
  res.status(201).json({ ok: true });
});

// DELETE /api/companies/:companyId/issues/:issueId/dependencies/:dependsOnId
router.delete("/:issueId/dependencies/:dependsOnId", async (req, res) => {
  await dependencyService.removeDependency(
    req.params.companyId, req.params.issueId, req.params.dependsOnId
  );
  res.json({ ok: true });
});
```

**Step 4: Wire onIssueCompleted into issue status change**

In the existing issue update handler (where status changes to `done`), add:

```typescript
if (newStatus === "done") {
  await dependencyService.onIssueCompleted(companyId, issueId);
}
```

**Step 5: Verify**

```bash
pnpm test:run
pnpm -r typecheck
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: task dependencies with cycle detection and auto-unblock

Add/remove dependencies via API. Recursive CTE cycle detection.
Auto-unblock dependent tasks when blocker completes.
Auto-wake assigned agents on dependency resolution.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Task Dependencies — Wire Auto-Wake on Unblock

**Files:**
- Modify: `server/src/services/dependencies.ts` — wire enqueueWakeup call
- Modify: `server/src/services/heartbeat.ts` — add "dependency_resolved" as invocation source

**Step 1: Add dependency_resolved to invocation sources**

In `packages/db/src/schema/heartbeat_runs.ts` or wherever `invocationSource` is defined, add `"dependency_resolved"` to the allowed values.

In `packages/db/src/schema/agent_wakeup_requests.ts`, add `"dependency_resolved"` to the `source` enum if it's an enum.

**Step 2: Wire the auto-wake in dependency service**

In `server/src/services/dependencies.ts`, the `onIssueCompleted` method should call the heartbeat service's `enqueueWakeup`:

```typescript
async onIssueCompleted(companyId: string, completedIssueId: string, heartbeatService: HeartbeatService) {
  const dependents = await this.getDependents(companyId, completedIssueId);

  for (const dep of dependents) {
    await this.recalculateBlockedStatus(companyId, dep.issueId);

    const issue = await db.select().from(issues)
      .where(eq(issues.id, dep.issueId)).limit(1);

    if (issue[0] && issue[0].assigneeAgentId && issue[0].status !== "blocked") {
      await heartbeatService.enqueueWakeup(issue[0].assigneeAgentId, {
        source: "dependency_resolved",
        payload: { issueId: dep.issueId, resolvedDependencyId: completedIssueId },
      });
    }
  }
}
```

**Step 3: Verify and commit**

```bash
pnpm -r typecheck
git add -A
git commit -m "feat: auto-wake agents when task dependencies resolve

Agents assigned to blocked tasks auto-wake immediately when
all dependencies complete. No heartbeat delay.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Task Dependencies — UI

**Files:**
- Modify: `ui/src/pages/IssueDetail.tsx` (or equivalent) — dependency section
- Modify: `ui/src/api/issues.ts` — add dependency API calls
- Create: `ui/src/components/DependencyPicker.tsx`

**Step 1: Add API client methods**

In the issues API file:

```typescript
export const dependenciesApi = {
  list: (companyId: string, issueId: string) =>
    api.get<IssueDependency[]>(`/companies/${companyId}/issues/${issueId}/dependencies`),

  add: (companyId: string, issueId: string, dependsOnId: string) =>
    api.post(`/companies/${companyId}/issues/${issueId}/dependencies`, { dependsOnId }),

  remove: (companyId: string, issueId: string, dependsOnId: string) =>
    api.delete(`/companies/${companyId}/issues/${issueId}/dependencies/${dependsOnId}`),
};
```

**Step 2: Create DependencyPicker component**

A searchable dropdown that lists issues in the same project. On select, adds a dependency. Shows current dependencies as removable chips with status indicators.

```tsx
// ui/src/components/DependencyPicker.tsx
// Searchable issue picker with:
// - Search input that filters issues by title
// - Excludes current issue and existing dependencies
// - Shows issue status chip next to each option
// - "Add dependency" button

// Below the picker, list current dependencies:
// [Status chip] Issue #12: "Build user API" [X remove]
// [Status chip] Issue #15: "Set up database" [X remove]
```

**Step 3: Add to issue detail page**

Add a "Dependencies" section to the issue detail page, below the description. Shows:
- "Blocked by" list with DependencyPicker
- "Blocks" list (read-only, shows issues that depend on this one)
- Visual indicator if issue is currently blocked

**Step 4: Add blocked status styling**

In the issue list and issue detail, the `blocked` status should show:
- Orange/amber color
- "Blocked" label with a lock or chain icon
- Tooltip showing what it's blocked by

**Step 5: Verify and commit**

```bash
pnpm -r typecheck && pnpm build
git add -A
git commit -m "feat: task dependency UI with picker and blocked status

Dependency picker on issue detail page.
Shows blocked-by and blocks relationships.
Blocked status with visual indicators.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Agent Failure Escalation — Schema

**Files:**
- Modify: `packages/db/src/schema/agents.ts` — add retry policy fields
- Modify: `packages/shared/src/types/` — update Agent type

**Step 1: Write test**

```typescript
describe("agent failure escalation schema", () => {
  it("should have retry policy fields on agents table", async () => {
    const { agents } = await import("@crewdeck/db/schema");
    expect(agents.retryPolicy).toBeDefined();
    expect(agents.consecutiveFailures).toBeDefined();
    expect(agents.fallbackAgentId).toBeDefined();
  });
});
```

**Step 2: Add columns to agents table**

In `packages/db/src/schema/agents.ts`:

```typescript
retryPolicy: jsonb("retry_policy").default({ maxRetries: 3, backoffSec: 300 }),
consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
fallbackAgentId: uuid("fallback_agent_id").references(() => agents.id),
```

**Step 3: Update shared types**

Add to the Agent type:
```typescript
retryPolicy: { maxRetries: number; backoffSec: number };
consecutiveFailures: number;
fallbackAgentId: string | null;
```

**Step 4: Generate migration and verify**

```bash
pnpm db:generate
pnpm -r typecheck
pnpm test:run
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add retry policy and fallback agent schema

Agents now have retryPolicy (maxRetries, backoffSec),
consecutiveFailures counter, and fallbackAgentId.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Agent Failure Escalation — Heartbeat Logic

**Files:**
- Modify: `server/src/services/heartbeat.ts` — failure handling in executeRun

**Step 1: Write test**

```typescript
describe("agent failure escalation", () => {
  it("should increment consecutive failures on run failure", () => {
    // Test the escalation decision logic
    const policy = { maxRetries: 3, backoffSec: 300 };
    const result = getEscalationAction(1, policy, "fallback-agent-id");
    expect(result.action).toBe("retry");
    expect(result.delaySec).toBe(300);
  });

  it("should reassign to fallback after max retries", () => {
    const policy = { maxRetries: 3, backoffSec: 300 };
    const result = getEscalationAction(3, policy, "fallback-agent-id");
    expect(result.action).toBe("reassign");
    expect(result.fallbackAgentId).toBe("fallback-agent-id");
  });

  it("should escalate to owner when no fallback", () => {
    const policy = { maxRetries: 3, backoffSec: 300 };
    const result = getEscalationAction(3, policy, null);
    expect(result.action).toBe("escalate");
  });
});
```

**Step 2: Implement escalation logic**

Add to `server/src/services/heartbeat.ts` in the failure handling section (~L1396-1460):

```typescript
type EscalationAction =
  | { action: "retry"; delaySec: number }
  | { action: "reassign"; fallbackAgentId: string }
  | { action: "escalate" };

function getEscalationAction(
  consecutiveFailures: number,
  retryPolicy: { maxRetries: number; backoffSec: number },
  fallbackAgentId: string | null
): EscalationAction {
  if (consecutiveFailures < retryPolicy.maxRetries) {
    return { action: "retry", delaySec: retryPolicy.backoffSec };
  }
  if (fallbackAgentId) {
    return { action: "reassign", fallbackAgentId };
  }
  return { action: "escalate" };
}
```

**Step 3: Wire into executeRun failure path**

In the catch block of `executeRun`:

```typescript
// After incrementing consecutiveFailures in DB:
const escalation = getEscalationAction(
  agent.consecutiveFailures + 1,
  agent.retryPolicy,
  agent.fallbackAgentId
);

switch (escalation.action) {
  case "retry":
    // Schedule retry with backoff
    setTimeout(() => {
      enqueueWakeup(agent.id, {
        source: "retry",
        payload: { issueId, attempt: agent.consecutiveFailures + 1 },
      });
    }, escalation.delaySec * 1000);
    break;

  case "reassign":
    // Reassign task to fallback agent
    await db.update(issues)
      .set({ assigneeAgentId: escalation.fallbackAgentId })
      .where(eq(issues.id, issueId));
    await enqueueWakeup(escalation.fallbackAgentId, {
      source: "assignment",
      payload: { issueId, reassignedFrom: agent.id },
    });
    // Emit notification event: agent.reassigned
    break;

  case "escalate":
    // Pause issue, notify owner
    await db.update(issues)
      .set({ status: "escalated" })
      .where(eq(issues.id, issueId));
    // Emit notification event: agent.escalation
    break;
}
```

**Step 4: Reset on success**

In the success path of executeRun, reset the counter:

```typescript
if (agent.consecutiveFailures > 0) {
  await db.update(agents)
    .set({ consecutiveFailures: 0 })
    .where(eq(agents.id, agent.id));
}
```

**Step 5: Circuit breaker — auto-pause after repeated failures across tasks**

```typescript
// After escalation, check if agent has hit max retries on 3+ tasks in 24h
const recentFailures = await db.execute(sql`
  SELECT COUNT(DISTINCT context_snapshot->>'issueId') as failed_tasks
  FROM heartbeat_runs
  WHERE agent_id = ${agent.id}
    AND status = 'failed'
    AND started_at > now() - interval '24 hours'
`);

if (recentFailures.rows[0]?.failed_tasks >= 3) {
  await db.update(agents)
    .set({ status: "paused" })
    .where(eq(agents.id, agent.id));
  // Emit: agent.circuit_breaker — "Agent paused: failed on 3+ tasks in 24h"
}
```

**Step 6: Verify and commit**

```bash
pnpm test:run
pnpm -r typecheck
git add -A
git commit -m "feat: agent failure escalation with retry, reassign, and circuit breaker

Agents retry with backoff on failure. After maxRetries, reassign to
fallback agent or escalate to owner. Circuit breaker pauses agent
after failures on 3+ tasks in 24h.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Post-Execution Review Gates — Schema

**Files:**
- Modify: `packages/db/src/schema/agents.ts` — add `requiresReview`
- Modify: `packages/db/src/schema/issues.ts` — add `reviewStatus`
- Modify: `packages/shared/src/types/` — update types

**Step 1: Add schema fields**

In agents table:
```typescript
requiresReview: boolean("requires_review").default(false).notNull(),
```

In issues table:
```typescript
reviewStatus: varchar("review_status", { length: 20 }),
// NULL = no review needed, 'pending_review', 'approved', 'rejected'
```

**Step 2: Update shared types**

Agent type: add `requiresReview: boolean`
Issue type: add `reviewStatus: "pending_review" | "approved" | "rejected" | null`

**Step 3: Generate migration and verify**

```bash
pnpm db:generate
pnpm -r typecheck
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add requiresReview and reviewStatus schema fields

Agents can be configured to require owner review.
Issues track review status (pending/approved/rejected).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Post-Execution Review Gates — Logic

**Files:**
- Modify: `server/src/services/heartbeat.ts` — review gate on task completion
- Modify: `server/src/routes/issues.ts` — approve/reject endpoints

**Step 1: Write test**

```typescript
describe("review gates", () => {
  it("should set pending_review when agent requires review", () => {
    const result = getCompletionAction({ requiresReview: true });
    expect(result.reviewStatus).toBe("pending_review");
    expect(result.issueStatus).toBe("in_progress"); // stays in progress
  });

  it("should complete normally when no review required", () => {
    const result = getCompletionAction({ requiresReview: false });
    expect(result.reviewStatus).toBeNull();
    expect(result.issueStatus).toBe("done");
  });
});
```

**Step 2: Implement review gate in heartbeat**

In the success path of executeRun, before marking issue as done:

```typescript
if (agent.requiresReview) {
  await db.update(issues)
    .set({ reviewStatus: "pending_review" })
    .where(eq(issues.id, issueId));
  // Emit: agent.review_pending
  // Do NOT mark issue as done — stays in_progress
} else {
  await db.update(issues)
    .set({ status: "done", completedAt: new Date() })
    .where(eq(issues.id, issueId));
  // Trigger dependency resolution
  await dependencyService.onIssueCompleted(companyId, issueId, heartbeatService);
}
```

**Step 3: Add approve/reject API endpoints**

In `server/src/routes/issues.ts`:

```typescript
// POST /api/companies/:companyId/issues/:issueId/review
router.post("/:issueId/review", async (req, res) => {
  const { action, feedback } = req.body; // action: "approve" | "reject"

  if (action === "approve") {
    await db.update(issues).set({
      reviewStatus: "approved",
      status: "done",
      completedAt: new Date(),
    }).where(eq(issues.id, req.params.issueId));

    // Trigger dependency resolution
    await dependencyService.onIssueCompleted(companyId, req.params.issueId, heartbeatService);
  } else if (action === "reject") {
    await db.update(issues).set({
      reviewStatus: "rejected",
    }).where(eq(issues.id, req.params.issueId));

    // Add rejection feedback as comment
    if (feedback) {
      await db.insert(issueComments).values({
        companyId,
        issueId: req.params.issueId,
        content: `Review rejected: ${feedback}`,
        authorType: "user",
      });
    }

    // Re-wake the agent with rejection feedback
    const issue = await db.select().from(issues)
      .where(eq(issues.id, req.params.issueId)).limit(1);

    if (issue[0]?.assigneeAgentId) {
      await heartbeatService.enqueueWakeup(issue[0].assigneeAgentId, {
        source: "review_rejected",
        payload: { issueId: req.params.issueId, feedback },
      });
    }
  }

  res.json({ ok: true });
});
```

**Step 4: Verify and commit**

```bash
pnpm test:run
pnpm -r typecheck
git add -A
git commit -m "feat: post-execution review gates

Agents with requiresReview=true trigger owner review on task completion.
Approve moves to done + unblocks dependencies.
Reject re-wakes agent with feedback.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Review Gates — UI

**Files:**
- Create: `ui/src/pages/ReviewQueue.tsx` — review queue page
- Modify: `ui/src/components/Sidebar.tsx` — add review queue nav with badge
- Modify: Issue detail page — inline approve/reject buttons
- Modify: Agent config form — add `requiresReview` toggle

**Step 1: Create ReviewQueue page**

A filtered list of issues with `reviewStatus = "pending_review"`:
- Shows issue title, assigned agent, cost, duration
- Approve / Reject buttons per item
- Reject opens a feedback input

**Step 2: Add to sidebar**

New nav item "Review Queue" with badge showing pending count.

**Step 3: Add requiresReview toggle to agent config**

In the agent settings/config form, add a toggle:
"Require owner review before completing tasks"

**Step 4: Verify and commit**

```bash
pnpm -r typecheck && pnpm build
git add -A
git commit -m "feat: review queue UI and agent review toggle

Review queue page with approve/reject actions.
Badge count in sidebar. requiresReview toggle in agent config.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Failure Escalation — UI

**Files:**
- Modify: Agent config form — retry policy settings, fallback agent picker
- Modify: Agent detail/list — failure indicators

**Step 1: Add retry policy config to agent form**

Fields:
- Max retries (number input, default 3)
- Backoff seconds (number input, default 300)
- Fallback agent (dropdown of other agents in same project)

**Step 2: Add failure indicators**

On agent list/detail:
- Show `consecutiveFailures` count when > 0
- Red badge "3/3 retries" when at max
- "Circuit breaker tripped" warning when agent paused due to repeated failures

**Step 3: Verify and commit**

```bash
pnpm -r typecheck && pnpm build
git add -A
git commit -m "feat: failure escalation UI — retry config and failure indicators

Agent config form with retry policy and fallback agent picker.
Visual failure indicators on agent list and detail pages.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary — Phase 1 Deliverables

After completing all 13 tasks:

| Feature | Schema | API | Logic | UI |
|---|---|---|---|---|
| Rebrand to Crewdeck | - | - | - | Done |
| Company → Project labels | - | - | - | Done |
| Task Dependencies | issue_dependencies table | CRUD + auto-unblock | Cycle detection, auto-wake | Picker + blocked status |
| Failure Escalation | retry_policy, consecutive_failures, fallback_agent_id | - | Retry, reassign, circuit breaker | Config form + indicators |
| Review Gates | requires_review, review_status | approve/reject endpoint | Review gate in heartbeat | Review queue page |

**Next:** Phase 2 plan covers outbound notifications, daily digest, quick commands, and performance metrics.
