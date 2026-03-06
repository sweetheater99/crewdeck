# Crewdeck v1 Design Document

> Crewdeck fork reframed as "Autopilot for solo AI companies"

**Date:** 2026-03-06
**Status:** Approved

---

## Vision

One founder, many AI agents, full visibility. Crewdeck is a lightweight control plane for solo founders running a team of AI agents. Agents work while you sleep. You wake up to a clear summary of what happened, what it cost, and what needs your attention.

## Target User

Solo founders, indie hackers, AI-native freelancers running 5-20 AI agents across multiple projects. They don't need enterprise governance — they need autonomous execution with observability.

## Rebrand Scope

| Crewdeck Term | Crewdeck Term | Notes |
|---|---|---|
| Company | Project | Multi-tenant stays, reframed as multi-project |
| Board | Owner | Single person, not a committee |
| Board Claim | Removed | No ceremony needed |
| Governance | Review Gates | Lightweight, per-agent |
| ClipMart | Removed | Not in v1 |
| Hire/Terminate | Add/Remove Agent | Less corporate |
| Principal Permission Grants | Removed | Single owner + agent permissions |

Package names: `@crewdeck/*` -> `@crewdeck/*`
CLI: `npx crewdeck` -> `npx crewdeck`
Config dir: `~/.crewdeck/` -> `~/.crewdeck/`

---

## Feature 1: Task Dependencies

### Problem
Tasks are flat. No way to express "don't start B until A is done." Overnight chains stall because each link waits for the next heartbeat or manual assignment.

### Design

**Schema:**
```sql
CREATE TABLE issue_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  issue_id UUID NOT NULL REFERENCES issues(id),        -- the blocked task
  depends_on_id UUID NOT NULL REFERENCES issues(id),   -- the blocker
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (issue_id, depends_on_id)
);
```

**New issue status:** `blocked` — auto-set when issue has unresolved dependencies.

**Unblock logic:** When a task moves to `done`:
1. Query all issues where `depends_on_id = completed_issue_id`
2. For each, check if ALL other dependencies are also `done`
3. If fully unblocked: set status to `backlog` (or `in_progress` if agent assigned)
4. If agent assigned: **auto-wake immediately** (enqueueWakeup with source: "dependency_resolved")

**Cycle detection:** On dependency creation, run a recursive CTE to detect cycles. Reject with 422 if found.

**UI:**
- Dependency picker on issue detail (searchable dropdown)
- Visual indicator: "Blocked by: Task #12, Task #15" with status chips
- Dependency chain view: simple tree showing the critical path

---

## Feature 2: Inter-Agent Messaging

### Problem
Agents can't communicate. If backend-agent needs to ask frontend-agent a question, it has no channel. Everything routes through the ticket system or waits for the owner.

### Design

**Schema:**
```sql
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  issue_id UUID REFERENCES issues(id),                 -- optional: context task
  from_agent_id UUID REFERENCES agents(id),            -- NULL = from owner
  to_agent_id UUID REFERENCES agents(id),              -- NULL = to owner (escalation)
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'message',          -- message, escalation, response
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Wakeup trigger:** When a message targets an agent, enqueue a wakeup with source: "message" and the message content in the context snapshot.

**Escalation rules (auto-escalate to owner when):**
- Agent failure threshold hit (Feature 5)
- Budget limit approaching (80%+)
- Agent explicitly sends `message_type: 'escalation'`
- No response from peer agent within configurable timeout (default: 30 min)

**Agent-to-agent flow:**
1. Agent A posts message targeting Agent B (via API)
2. Agent B gets wakeup with message context
3. Agent B responds (new message targeting Agent A)
4. Agent A picks up response on next run

**Owner escalation flow:**
1. Agent posts message with `to_agent_id: NULL`
2. Outbound notification fires (Feature 3)
3. Owner can reply via UI or Quick Commands (Feature 12)

---

## Feature 3: Outbound Notifications

### Problem
Events only reach the WebSocket UI. If you're not staring at the dashboard, you miss everything.

### Design

**Schema:**
```sql
CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  channel_type VARCHAR(20) NOT NULL,   -- telegram, discord, webhook
  config JSONB NOT NULL,               -- {chatId, botToken} | {webhookUrl} | {webhookUrl, secret}
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  channel_id UUID NOT NULL REFERENCES notification_channels(id),
  event_type VARCHAR(50) NOT NULL,     -- task.completed, agent.failed, agent.budget_warning, etc.
  filter JSONB,                        -- optional: {agentId: "x"} or {priority: "high"}
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Supported channels:**
- **Telegram:** Bot API, send to chat ID. Uses HTML parse_mode (not Markdown).
- **Discord:** Webhook URL, rich embeds.
- **Generic webhook:** POST JSON payload to URL with optional HMAC signature.

**Event types:**
- `task.completed` — task marked done
- `task.failed` — task execution failed
- `task.unblocked` — dependency resolved, task ready
- `agent.failed` — agent run failed
- `agent.escalation` — agent escalated to owner
- `agent.budget_warning` — 80% of monthly budget spent
- `agent.budget_exceeded` — agent paused due to budget
- `agent.review_pending` — work awaiting owner review (Feature 4)
- `digest.daily` — morning summary (Feature 8)
- `chain.completed` — full dependency chain finished

**Implementation:** Event listener in the heartbeat service. On each event, match against notification_rules, fan out to channels. Async — don't block the run.

**Settings UI:** Project settings page with channel configuration and rule builder.

---

## Feature 4: Post-Execution Review Gates

### Problem
Agents complete work and auto-mark tasks done. No review step. Bad code ships silently.

### Design

**Schema change:**
```sql
ALTER TABLE agents ADD COLUMN requires_review BOOLEAN DEFAULT false;
ALTER TABLE issues ADD COLUMN review_status VARCHAR(20);
-- NULL = no review needed, 'pending_review', 'approved', 'rejected'
```

**Flow:**
1. Agent completes task execution
2. If `agent.requires_review = true`:
   - Issue status stays `in_progress`
   - `review_status` set to `pending_review`
   - Notification fires: `agent.review_pending`
3. Owner reviews (UI or Quick Command):
   - **Approve:** `review_status = 'approved'`, issue moves to `done`, downstream dependencies unblock
   - **Reject:** `review_status = 'rejected'`, issue stays `in_progress`, rejection reason added as comment, agent re-wakes with feedback

**UI:**
- Review queue page (filtered view of issues with `review_status = 'pending_review'`)
- Inline approve/reject buttons on issue detail
- Badge count in sidebar

---

## Feature 5: Agent Failure Escalation

### Problem
Agent fails, retries on next heartbeat with same approach. Burns tokens forever.

### Design

**Schema change:**
```sql
ALTER TABLE agents ADD COLUMN retry_policy JSONB DEFAULT '{"maxRetries": 3, "backoffSec": 300}';
ALTER TABLE agents ADD COLUMN consecutive_failures INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN fallback_agent_id UUID REFERENCES agents(id);
```

**Flow:**
1. Agent run fails
2. Increment `consecutive_failures`
3. If `consecutive_failures < maxRetries`:
   - Wait `backoffSec` before next attempt
   - Re-enqueue wakeup with backoff delay
4. If `consecutive_failures >= maxRetries`:
   - If `fallback_agent_id` exists and is healthy:
     - Reassign task to fallback agent
     - Reset fallback agent's failure count for this task
     - Notify owner: "Reassigned Task #12 from agent-a to agent-b after 3 failures"
   - If no fallback or fallback also failed:
     - Escalate to owner (message + notification)
     - Pause the task in `escalated` state
5. On successful completion: reset `consecutive_failures` to 0

**Circuit breaker:** If an agent hits max retries on 3 different tasks in a 24h window, auto-pause the agent entirely and notify owner.

---

## Feature 6: Performance Metrics Dashboard

### Problem
Only cost data exists. No way to measure agent productivity or efficiency.

### Design

**No new tables.** Aggregated from existing data:
- `heartbeat_runs` — success/failure counts, duration
- `cost_events` — spend per agent/project
- `issues` — completion counts, time to complete

**API endpoints:**
```
GET /api/projects/:projectId/metrics/agents
GET /api/projects/:projectId/metrics/overview
GET /api/projects/:projectId/metrics/trends
```

**Agent scorecard:**
| Metric | Source |
|---|---|
| Tasks completed (week/month) | issues WHERE status = 'done' |
| Success rate | heartbeat_runs success vs failed |
| Avg task duration | issues completedAt - createdAt |
| Cost per completed task | cost_events sum / completed tasks |
| Current streak | consecutive successes or failures |
| Utilization | time in runs / total time |

**Overview metrics:**
- Total spend this month vs budget
- Tasks completed vs created (velocity)
- Active agents vs idle
- Top performer / worst performer

**Trends:** Daily/weekly charts for spend, task throughput, failure rate.

**UI:** New "Metrics" page with:
- Agent leaderboard table (sortable by any metric)
- Spend chart (line, by day)
- Task throughput chart (bar, by week)
- Agent utilization heatmap

---

## Feature 7: Shared Knowledge Base

### Problem
Agents have no institutional memory. Agent A learns something, Agent B asks the same question tomorrow.

### Design

**Schema:**
```sql
CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  project_id UUID REFERENCES projects(id),             -- NULL = company-wide
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_by_agent_id UUID REFERENCES agents(id),      -- NULL = created by owner
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_knowledge_tags ON knowledge_entries USING GIN (tags);
CREATE INDEX idx_knowledge_search ON knowledge_entries USING GIN (
  to_tsvector('english', title || ' ' || content)
);
```

**Agent API:**
```
POST   /api/projects/:projectId/knowledge          -- write entry
GET    /api/projects/:projectId/knowledge?tags=X&q=Y -- search
GET    /api/projects/:projectId/knowledge/:id       -- read entry
PATCH  /api/projects/:projectId/knowledge/:id       -- update
DELETE /api/projects/:projectId/knowledge/:id       -- delete
```

**Context injection:** When an agent wakes for a task, the heartbeat service queries relevant knowledge entries (by project + tags matching task labels) and includes them in the context snapshot.

**Embeddings-ready:** The schema supports adding a `vector` column later for semantic search. For v1, Postgres full-text search + GIN index on tags is sufficient.

**UI:** Knowledge browser page with:
- Tag cloud / filter
- Search bar
- Entry list with preview
- Create/edit modal

---

## Feature 8: Daily Digest

### Problem
No summary view. You have to manually check the dashboard every morning.

### Design

**Scheduled job:** Cron-like function that runs at a configurable time (default: 8:00 AM owner's timezone).

**Digest content:**
```
Crewdeck Daily Digest - Project Alpha
2026-03-06

Overnight Summary:
- 7 tasks completed, 2 failed
- $4.20 spent ($15.80 remaining this month)
- 3 dependency chains advanced

Agent Status:
- backend-bot: 4 tasks done, 1 failed (retrying)
- frontend-bot: 2 tasks done, idle
- test-bot: 1 task done, blocked on Task #18

Needs Your Attention:
- Review queue: 3 items pending
- backend-bot escalated Task #15 (3 failures)
- design-bot at 85% monthly budget

Today's Queue:
- 5 tasks ready to execute
- 2 tasks blocked (waiting on Task #22)
```

**Delivery:** Sent via configured notification channels (Feature 3). Event type: `digest.daily`.

**Schema change:**
```sql
ALTER TABLE notification_channels ADD COLUMN digest_time TIME;         -- e.g. '08:00'
ALTER TABLE notification_channels ADD COLUMN digest_timezone VARCHAR(50); -- e.g. 'Asia/Kolkata'
```

---

## Feature 9: One-Click Deploy (Docker)

### Problem
Requires Node 20 + pnpm + embedded Postgres setup. Too many steps for solo founders.

### Design

**Single Dockerfile** that bundles:
- Node.js runtime
- Built server + UI
- Embedded PostgreSQL

**Usage:**
```bash
docker run -d \
  -p 3100:3100 \
  -v crewdeck-data:/root/.crewdeck \
  crewdeck/crewdeck:latest
```

**Docker Compose (with external Postgres):**
```yaml
services:
  crewdeck:
    image: crewdeck/crewdeck:latest
    ports: ["3100:3100"]
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/crewdeck
    volumes: ["crewdeck-data:/root/.crewdeck"]
  db:
    image: postgres:17
    volumes: ["pg-data:/var/lib/postgresql/data"]
```

**The existing Dockerfile is close** — mainly needs rebranding and ensuring embedded Postgres works inside the container.

---

## Feature 10: Mobile-First Dashboard

### Problem
UI is desktop-first. Solo founders manage from their phone.

### Design

**Not a rewrite** — responsive overhaul of existing React UI:

**Key changes:**
- Sidebar collapses to bottom nav on mobile (already partially implemented)
- Issue list: card layout on mobile, table on desktop
- Agent list: stack layout on mobile
- Review queue: swipe-to-approve/reject
- Metrics: stacked charts, no side-by-side on mobile
- Properties panel: full-screen sheet on mobile, side panel on desktop

**Breakpoints:**
- `< 640px` — mobile (single column, bottom nav)
- `640-1024px` — tablet (collapsible sidebar)
- `> 1024px` — desktop (full layout)

**Priority screens for mobile:**
1. Dashboard overview (what happened, what needs attention)
2. Review queue (approve/reject)
3. Agent status list
4. Notifications / inbox

---

## Feature 11: Agent Log Viewer

### Problem
Stdout/stderr logs exist but are hard to navigate. No searchable timeline.

### Design

**Uses existing data:** `heartbeat_runs` + `heartbeat_run_events` tables.

**UI: Timeline view per agent:**
- Chronological list of runs
- Each run expandable to show:
  - Duration, status, cost
  - Stdout/stderr in a terminal-like viewer
  - Tool calls highlighted
  - Errors highlighted in red
- Search across all runs (full-text on event content)
- Filter by: date range, status (success/failed), task

**UI: Per-issue log:**
- All runs related to this task, in order
- Shows the "story" of how a task was completed (or failed)

**No new schema** — this is a UI-only feature using existing heartbeat_run_events data.

---

## Feature 12: Quick Commands from Notifications

### Problem
You get a Telegram alert but have to open the dashboard to take action. Context switch kills flow.

### Design

**Telegram bot commands** (via inline keyboard buttons on notifications):

When a notification fires, attach action buttons:

**Task failed notification:**
```
Agent backend-bot failed on Task #12: "Build user API"
Error: Connection timeout to database
Attempt 2/3

[Retry] [Reassign] [Pause] [View]
```

**Review pending notification:**
```
Agent frontend-bot completed Task #8: "Build login page"
Cost: $0.85 | Duration: 12min

[Approve] [Reject] [View]
```

**Budget warning:**
```
Agent test-bot at 85% monthly budget ($42.50 / $50.00)

[Increase to $75] [Pause Agent] [View]
```

**Implementation:**
- Telegram: Inline keyboard callbacks via Bot API
- Discord: Button components on embeds
- Webhook: Action URLs included in payload (signed with HMAC)

**Callback handler:** New route `POST /api/notifications/callback` that:
1. Validates the callback signature
2. Executes the action (retry, approve, pause, etc.)
3. Sends confirmation message back to the channel

---

## Implementation Order

```
Phase 1 - Foundation (schema + core logic):
  1. Rebrand (Crewdeck -> Crewdeck)
  2. Task Dependencies
  3. Agent Failure Escalation
  4. Post-Execution Review Gates

Phase 2 - Observability:
  5. Outbound Notifications (Telegram + Discord + Webhook)
  6. Daily Digest
  7. Quick Commands from Notifications
  8. Performance Metrics Dashboard

Phase 3 - Intelligence + Polish:
  9. Inter-Agent Messaging
  10. Shared Knowledge Base
  11. Agent Log Viewer
  12. Mobile-First Dashboard

Phase 4 - Ship:
  13. One-Click Deploy (Docker)
  14. Landing page + docs
```

---

## Tech Stack (unchanged)

- **Server:** Express + TypeScript
- **DB:** PostgreSQL (Drizzle ORM)
- **UI:** React 19 + Vite + Tailwind v4
- **CLI:** Commander.js
- **Monorepo:** pnpm workspaces
