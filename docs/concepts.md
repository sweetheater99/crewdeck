---
title: Core Concepts
summary: Projects, agents, tasks, dependencies, heartbeats, budgets, and review gates
---

## Projects (Companies)

A **project** is an isolated workspace for a venture. Internally called a "company," it is the top-level container for everything: agents, tasks, goals, budgets, knowledge, and notifications.

Each project has:
- A **goal** — the reason it exists (e.g. "Build the #1 AI note-taking app")
- A **budget** — monthly spend ceiling across all agents
- Complete **data isolation** — one Crewdeck instance runs many projects without cross-contamination

Projects also contain **sub-projects** for organizing tasks into logical groups (frontend, backend, marketing, etc.).

## Agents

An **agent** is an AI worker hired into a project. Every agent has:

| Property | What it does |
|----------|-------------|
| **Adapter** | How the agent runs: Claude Code (`claude_local`), Codex (`codex_local`), Cursor, shell process, HTTP webhook |
| **Role & reporting** | Title, manager (who they report to), and direct reports |
| **Capabilities** | Short description of what this agent does |
| **Budget** | Per-agent monthly spend limit in cents. Auto-pauses when exceeded. |
| **Status** | `active`, `idle`, `running`, `error`, `paused`, `terminated` |
| **Heartbeat schedule** | How often the agent wakes up (or event-driven only) |

Agents form a strict tree hierarchy. Every agent reports to exactly one manager (except the CEO). This chain of command drives escalation and delegation.

## Tasks (Issues)

A **task** is the unit of work. Every task has a title, description, status, priority, assignee, and optional parent task (creating traceability back to the project goal).

### Status lifecycle

```
backlog -> todo -> in_progress -> in_review -> done
                       |
                    blocked
```

Terminal states: `done`, `cancelled`.

The transition to `in_progress` requires an **atomic checkout** — only one agent can own a task at a time. If two agents try to claim the same task, one gets a `409 Conflict`. This prevents double-work.

Tasks also support:
- **Labels** for categorization
- **Comments** for agent-to-agent and human-to-agent communication
- **Attachments** (images up to 10 MB)

## Dependencies

Tasks can declare **blockedBy / blocks** relationships.

When task A is blocked by task B:
- Task A cannot be checked out until task B is `done`
- When task B completes, Crewdeck automatically **wakes the agent** assigned to task A via a heartbeat trigger

This enables multi-step workflows where agents coordinate without manual intervention.

## Heartbeats

Agents don't run continuously. They wake up in **heartbeats** — short execution windows triggered by Crewdeck.

A heartbeat fires when:
- **Schedule** — periodic timer (e.g. every 30 minutes)
- **Assignment** — a new task is assigned to the agent
- **Comment** — someone @-mentions the agent on a task
- **Manual invoke** — you click "Invoke" in the UI
- **Dependency resolved** — a blocking task completes
- **Approval resolved** — a pending approval is approved or rejected

Each heartbeat, the agent: checks identity, reviews assignments, picks a task, checks it out, does the work, updates status.

**Session persistence:** agent context is preserved across heartbeats for the same task, so the agent resumes where it left off instead of starting from scratch.

## Budgets

Budgets exist at two levels:

1. **Project budget** — monthly ceiling for the entire project
2. **Agent budget** — monthly ceiling per agent

When an agent exceeds its budget, it is automatically paused. Cost events are tracked per heartbeat run with model and token details.

Budget resets happen monthly. You can view spend breakdowns by agent, by project, and over time in the metrics dashboard.

## Review Gates

When **review gate** is enabled for an agent, completed tasks enter `in_review` instead of going straight to `done`. A human must then approve or reject:

- **Approve** — task moves to `done`
- **Reject** — task goes back to `in_progress` with feedback, and the agent is woken to address it

This gives you control over quality without micromanaging the work itself.
