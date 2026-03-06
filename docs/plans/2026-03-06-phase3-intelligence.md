# Phase 3: Intelligence + Polish — Messaging, Knowledge, Logs, Mobile

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inter-agent messaging, shared knowledge base, agent log viewer, and mobile-responsive dashboard.

**Architecture:** Two new DB tables (messages, knowledge), new service modules, UI pages, and responsive CSS overhaul.

**Tech Stack:** TypeScript, Express, Drizzle ORM, PostgreSQL, React 19, Vite, Tailwind CSS 4

---

## Task 1: Inter-Agent Messaging — Schema

**Create:** `packages/db/src/schema/agent_messages.ts`

```
agent_messages table:
  id: uuid PK
  companyId: uuid FK -> companies
  issueId: uuid FK -> issues (nullable, optional context)
  fromAgentId: uuid FK -> agents (nullable, NULL = from owner)
  toAgentId: uuid FK -> agents (nullable, NULL = to owner/escalation)
  content: text NOT NULL
  messageType: text DEFAULT 'message'  // message, escalation, response
  readAt: timestamptz (nullable)
  createdAt: timestamptz DEFAULT now
```

Add shared types: AgentMessage interface, MessageType union.
Export from schema index. Generate migration.

---

## Task 2: Inter-Agent Messaging — Service + Routes

**Create:** `server/src/services/messages.ts`

Methods:
- `send(companyId, { fromAgentId, toAgentId, issueId?, content, messageType })` — insert message, trigger wakeup on target agent if toAgentId is set
- `listForIssue(companyId, issueId)` — all messages related to an issue
- `listForAgent(companyId, agentId)` — messages to/from an agent
- `listUnread(companyId, agentId)` — unread messages for an agent
- `markRead(messageId)` — set readAt

**Routes:** `server/src/routes/messages.ts`

```
GET    /api/companies/:companyId/messages?agentId=X&issueId=Y
POST   /api/companies/:companyId/messages
PATCH  /api/companies/:companyId/messages/:id/read
```

When a message is sent to an agent, enqueue a wakeup with source "automation" and reason "message_received", including the message content in the context.

When a message is sent to owner (toAgentId=null), emit notification event "agent.message" so it goes to Telegram/Discord.

Mount in app.ts.

---

## Task 3: Inter-Agent Messaging — UI

**Create:** `ui/src/components/MessageThread.tsx`

A chat-like thread component:
- Shows messages chronologically with sender name, timestamp
- Owner messages on right, agent messages on left
- Text input at bottom to send messages
- Can be embedded in issue detail (contextual) or agent detail (all messages)

**Modify:** Issue detail page — add a "Messages" tab alongside existing tabs
**Modify:** Agent detail page — add a messages section
**Add:** API client methods, query keys

---

## Task 4: Shared Knowledge Base — Schema

**Create:** `packages/db/src/schema/knowledge_entries.ts`

```
knowledge_entries table:
  id: uuid PK
  companyId: uuid FK -> companies
  projectId: uuid FK -> projects (nullable, NULL = company-wide)
  title: varchar(255) NOT NULL
  content: text NOT NULL
  tags: text[] DEFAULT '{}'
  createdByAgentId: uuid FK -> agents (nullable, NULL = owner)
  createdAt: timestamptz DEFAULT now
  updatedAt: timestamptz DEFAULT now
```

Add GIN index on tags array.
Add GIN index on to_tsvector('english', title || ' ' || content) for full-text search.

Shared types: KnowledgeEntry interface.
Export, generate migration.

---

## Task 5: Shared Knowledge Base — Service + Routes

**Create:** `server/src/services/knowledge.ts`

Methods:
- `create(companyId, { projectId?, title, content, tags, createdByAgentId? })`
- `update(id, { title?, content?, tags? })`
- `delete(id)`
- `search(companyId, { projectId?, query?, tags? })` — full-text search + tag filter
- `getForContext(companyId, projectId?, tags?)` — get relevant entries for agent context injection

**Routes:** `server/src/routes/knowledge.ts`

```
GET    /api/companies/:companyId/knowledge?projectId=X&q=Y&tags=a,b
POST   /api/companies/:companyId/knowledge
GET    /api/companies/:companyId/knowledge/:id
PATCH  /api/companies/:companyId/knowledge/:id
DELETE /api/companies/:companyId/knowledge/:id
```

Wire into heartbeat: when building context snapshot for a run, include relevant knowledge entries (query by project + issue labels/tags).

Mount in app.ts.

---

## Task 6: Shared Knowledge Base — UI

**Create:** `ui/src/pages/Knowledge.tsx`

Knowledge browser page:
- Search bar (full-text search)
- Tag filter (clickable tag cloud or multi-select)
- Entry list with title, preview snippet, tags, author, date
- Click to expand/view full entry
- Create/edit dialog: title, content (markdown), tags (comma-separated or tag input)
- Delete confirmation

**Add:** Sidebar nav item "Knowledge" with BookOpen icon.
**Add:** Route, API client, query keys.

---

## Task 7: Agent Log Viewer — UI

No new schema — uses existing heartbeat_runs + heartbeat_run_events.

**Create:** `ui/src/pages/AgentLogs.tsx` (or enhance existing run viewer)

A timeline view:
- Chronological list of heartbeat runs for an agent
- Each run shows: timestamp, duration, status badge, cost, associated issue
- Expandable: click to show full stdout/stderr in a terminal-style viewer
- Errors highlighted in red
- Tool calls highlighted (if parseable from stdout)
- Search across all runs (filter by text in event content)
- Filter by: date range, status (succeeded/failed), issue

**Also create:** `ui/src/components/RunLogViewer.tsx`

A terminal-like component that renders heartbeat_run_events:
- Monospace font, dark background
- stdout in white/light gray
- stderr in red
- system events in blue/cyan
- Auto-scroll to bottom, with "scroll to top" button

**Modify:** Agent detail page — add "Logs" tab or section linking to the log viewer.
**Modify:** Issue detail page — show run logs for runs associated with this issue.

**API:** The existing run events API should work. Check:
- `GET /api/companies/:companyId/agents/:agentId/heartbeat/runs` (or similar)
- `GET /api/heartbeat/runs/:runId/events` (or similar)

Read the existing routes to find the right endpoints.

---

## Task 8: Mobile-First Dashboard — Responsive Overhaul

Not a rewrite — responsive CSS adjustments to existing pages.

**Key changes:**

1. **Sidebar** — Already has bottom nav for mobile (partially implemented). Verify it works, fix gaps.

2. **Issue list** — Card layout on mobile (<640px), table on desktop. Each card shows: status icon, identifier, title, assignee, priority.

3. **Agent list** — Stack layout on mobile. Each card: status, name, adapter type, current task.

4. **Dashboard** — Stack metrics cards vertically on mobile. Charts full-width.

5. **Metrics page** — Stack cards, full-width charts, horizontal scroll for leaderboard table.

6. **Review queue** — Full-width cards with large approve/reject buttons (thumb-friendly).

7. **Properties panel** — Full-screen sheet on mobile (slide up), side panel on desktop.

8. **General:**
   - Touch-friendly tap targets (min 44px)
   - No hover-only interactions on mobile
   - Responsive text sizes

**Breakpoints (Tailwind):**
- Default: mobile-first
- `sm:` (640px): tablet
- `lg:` (1024px): desktop

---

## Implementation Order

Tasks 1-3 (messaging) are sequential.
Tasks 4-6 (knowledge) are sequential.
Task 7 (logs) is independent.
Task 8 (mobile) is independent.

Parallel opportunities:
- Task 1 + Task 4 (both schema)
- Task 2 + Task 5 (both services)
- Task 3 + Task 6 + Task 7 + Task 8 (all UI, different pages)
