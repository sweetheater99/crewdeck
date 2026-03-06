# Phase 2: Observability — Notifications, Digest, Quick Commands, Metrics

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add outbound notifications (Telegram/Discord/webhook), daily digest, quick commands from notifications, and performance metrics dashboard.

**Architecture:** New notification service with event listener pattern, scheduled digest job, Telegram bot callback handler, aggregation queries over existing data for metrics.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, React 19, Vite, node-telegram-bot-api (or raw fetch), recharts for charts

---

## Task 1: Notification System — Schema

**Files:**
- Create: `packages/db/src/schema/notification_channels.ts`
- Create: `packages/db/src/schema/notification_rules.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/shared/src/types/`
- Generate migration

**Schema:**

```typescript
// notification_channels
id: uuid PK
companyId: uuid FK -> companies
channelType: text NOT NULL  // 'telegram', 'discord', 'webhook'
label: text                 // user-friendly name
config: jsonb NOT NULL      // channel-specific config
enabled: boolean DEFAULT true
createdAt: timestamptz
updatedAt: timestamptz

// notification_rules
id: uuid PK
companyId: uuid FK -> companies
channelId: uuid FK -> notification_channels
eventType: text NOT NULL    // 'task.completed', 'agent.failed', etc.
filter: jsonb               // optional: {agentId, priority}
enabled: boolean DEFAULT true
createdAt: timestamptz
```

**Config shapes by channel type:**
- telegram: `{ botToken: string, chatId: string }`
- discord: `{ webhookUrl: string }`
- webhook: `{ url: string, secret?: string }`

**Shared types:** NotificationChannel, NotificationRule interfaces. Event type enum/constants.

---

## Task 2: Notification System — Service + Senders

**Files:**
- Create: `server/src/services/notifications.ts`
- Create: `server/src/services/notification-senders/telegram.ts`
- Create: `server/src/services/notification-senders/discord.ts`
- Create: `server/src/services/notification-senders/webhook.ts`

**Service responsibilities:**

`emit(companyId, eventType, payload)`:
1. Query notification_rules matching companyId + eventType + filter
2. For each matching rule, get the channel
3. Format message based on eventType
4. Send via the appropriate sender (telegram/discord/webhook)
5. Fire-and-forget (don't block the caller)
6. Log errors but don't throw

**Telegram sender:**
- Use fetch to call Telegram Bot API directly (no npm package needed)
- `POST https://api.telegram.org/bot{token}/sendMessage`
- parse_mode: "HTML" (not Markdown — per project gotchas)
- Support inline keyboard buttons for quick commands (Task 5)

**Discord sender:**
- POST to webhook URL with rich embed format

**Webhook sender:**
- POST JSON payload to configured URL
- Optional HMAC-SHA256 signature in `X-Crewdeck-Signature` header

**Message formatting:**
Each event type has a template:
- task.completed: "Task #{id}: {title} completed by {agentName}. Cost: ${cost}"
- task.failed: "Task #{id}: {title} failed. Error: {error}. Attempt {n}/{max}"
- agent.escalation: "Agent {name} escalated Task #{id}: {reason}"
- agent.budget_warning: "Agent {name} at {pct}% of monthly budget (${spent}/${budget})"
- agent.review_pending: "Review needed: Task #{id}: {title} by {agentName}"

---

## Task 3: Notification System — Wire Events

**Files:**
- Modify: `server/src/services/heartbeat.ts` — emit events on run success/failure
- Modify: `server/src/routes/issues.ts` — emit on task completion
- Modify: `server/src/services/dependencies.ts` — emit on task unblocked
- Modify: `server/src/services/costs.ts` — emit on budget warning/exceeded

**Events to wire:**

| Event | Where to emit | Trigger |
|---|---|---|
| task.completed | heartbeat success path / issue review approve | Issue status -> done |
| task.failed | heartbeat failure path | Run status -> failed |
| task.unblocked | dependencies.onIssueCompleted | Issue unblocked |
| agent.failed | heartbeat failure escalation | Agent consecutive failure |
| agent.escalation | heartbeat escalation path | Max retries hit, no fallback |
| agent.budget_warning | costs.createEvent | spentMonthlyCents >= 80% of budget |
| agent.budget_exceeded | costs.createEvent | spentMonthlyCents >= budget |
| agent.review_pending | heartbeat success path | requiresReview agent completes |
| agent.circuit_breaker | heartbeat circuit breaker | 3+ task failures in 24h |

Each emit call is fire-and-forget with error logging.

---

## Task 4: Notification System — API Routes + Settings UI

**Files:**
- Create: `server/src/routes/notifications.ts`
- Modify: `server/src/app.ts` — mount notification routes
- Create: `ui/src/pages/NotificationSettings.tsx`
- Modify: `ui/src/api/` — add notification API methods
- Modify: Sidebar or project settings — add link to notification settings

**API Routes:**

```
GET    /api/companies/:companyId/notifications/channels
POST   /api/companies/:companyId/notifications/channels
PATCH  /api/companies/:companyId/notifications/channels/:id
DELETE /api/companies/:companyId/notifications/channels/:id
POST   /api/companies/:companyId/notifications/channels/:id/test  (send test message)

GET    /api/companies/:companyId/notifications/rules
POST   /api/companies/:companyId/notifications/rules
PATCH  /api/companies/:companyId/notifications/rules/:id
DELETE /api/companies/:companyId/notifications/rules/:id
```

**Settings UI:**

A page accessible from project settings with two sections:

1. **Channels** — List of configured channels. Add/edit form with:
   - Channel type picker (Telegram / Discord / Webhook)
   - Type-specific config fields (bot token + chat ID / webhook URL / URL + secret)
   - Enable/disable toggle
   - "Send test" button

2. **Rules** — List of notification rules. Add/edit form with:
   - Event type dropdown (all supported events)
   - Channel picker (from configured channels)
   - Optional filter (agent picker)
   - Enable/disable toggle

---

## Task 5: Quick Commands from Notifications

**Files:**
- Modify: `server/src/services/notification-senders/telegram.ts` — add inline keyboards
- Create: `server/src/routes/notification-callbacks.ts` — callback handler
- Modify: `server/src/app.ts` — mount callback route

**Telegram inline keyboards:**

When sending notifications, attach action buttons:

task.failed:
```json
{ "inline_keyboard": [[
  {"text": "Retry", "callback_data": "action:retry:ISSUE_ID"},
  {"text": "Pause", "callback_data": "action:pause:AGENT_ID"},
  {"text": "View", "url": "https://HOST/PROJECT/issues/ISSUE_ID"}
]]}
```

agent.review_pending:
```json
{ "inline_keyboard": [[
  {"text": "Approve", "callback_data": "action:approve:ISSUE_ID"},
  {"text": "Reject", "callback_data": "action:reject:ISSUE_ID"},
  {"text": "View", "url": "https://HOST/PROJECT/issues/ISSUE_ID"}
]]}
```

**Callback handler:**

Telegram sends callback queries to a webhook. We need:
1. A route to register as Telegram webhook: `POST /api/notifications/telegram/webhook`
2. Parse callback_data to extract action and entity ID
3. Execute the action (retry task, approve review, pause agent, etc.)
4. Answer the callback query with confirmation
5. Update the original message to reflect the action taken

**For Discord:** Use button components with custom_id, similar pattern.

**For generic webhook:** Include action URLs in the payload with HMAC signatures.

---

## Task 6: Daily Digest — Schema + Service

**Files:**
- Modify: `packages/db/src/schema/notification_channels.ts` — add digest fields
- Create: `server/src/services/digest.ts`

**Schema additions to notification_channels:**
```typescript
digestEnabled: boolean DEFAULT false
digestTime: text  // e.g. "08:00"
digestTimezone: text  // e.g. "Asia/Kolkata"
```

**Digest service:**

`generateDigest(companyId, since: Date)`:
Queries existing data and returns a formatted summary:

```
Crewdeck Daily Digest - {Project Name}
{date}

Overnight Summary:
- {n} tasks completed, {n} failed
- ${spent} spent (${remaining} remaining this month)
- {n} dependency chains advanced

Agent Status:
- {agent}: {n} tasks done, {status}
- ...

Needs Your Attention:
- Review queue: {n} items pending
- {agent} escalated Task #{id} ({n} failures)
- {agent} at {pct}% monthly budget

Today's Queue:
- {n} tasks ready to execute
- {n} tasks blocked
```

**Scheduler:**

Add a check in the heartbeat scheduler tick (or a separate interval). Every minute, check if any channel has digestEnabled=true and current time matches digestTime in their timezone. If so, generate and send digest.

---

## Task 7: Performance Metrics — API

**Files:**
- Create: `server/src/services/metrics.ts`
- Create: `server/src/routes/metrics.ts`
- Modify: `server/src/app.ts` — mount metrics routes

**No new tables.** Aggregate from existing data.

**API Endpoints:**

```
GET /api/companies/:companyId/metrics/overview
  -> { totalSpend, budget, tasksCompleted, tasksFailed, activeAgents, idleAgents }

GET /api/companies/:companyId/metrics/agents
  -> [{ agentId, name, tasksCompleted, tasksFailed, successRate, avgDurationMin, costPerTask, consecutiveFailures, utilization }]

GET /api/companies/:companyId/metrics/trends?period=7d|30d
  -> { daily: [{ date, spend, tasksCompleted, tasksFailed }] }
```

**Queries:**

Overview: aggregate from issues (status=done count), heartbeat_runs (failed count), cost_events (sum), agents (count by status).

Agents: group heartbeat_runs by agent_id, join with cost_events, calculate success rate and avg duration.

Trends: group by date from heartbeat_runs and cost_events.

---

## Task 8: Performance Metrics — UI

**Files:**
- Create: `ui/src/pages/Metrics.tsx`
- Modify: `ui/src/api/` — add metrics API methods
- Modify: Sidebar — add "Metrics" nav item
- Modify: Router — add metrics route

**Page layout:**

1. **Overview cards** (top row): Total spend, tasks completed, tasks failed, active agents
2. **Agent leaderboard** (table): Sortable by any metric column. Columns: agent name, tasks done, success rate, avg duration, cost/task, streak
3. **Trends charts** (bottom):
   - Spend over time (line chart)
   - Task throughput (bar chart: completed vs failed by day)

Use existing chart patterns if any, otherwise use recharts (check if it's already a dependency). If not, use simple HTML/CSS bar charts to avoid adding a dependency.

---

## Implementation Order

Tasks 1-3 are sequential (schema -> service -> wiring).
Task 4 (API + UI) depends on 1-3.
Task 5 (quick commands) depends on 2-4.
Task 6 (digest) depends on 2-3.
Tasks 7-8 (metrics) are independent of notifications.

```
Task 1: Schema ─────────┐
Task 2: Service/Senders ─┤
Task 3: Wire Events ─────┤
Task 4: API + Settings UI ──> Task 5: Quick Commands
Task 6: Daily Digest ────┘
Task 7: Metrics API ────> Task 8: Metrics UI
```
