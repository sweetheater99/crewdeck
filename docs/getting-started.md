---
title: Getting Started
summary: Install Crewdeck and run your first AI company in under 10 minutes
---

## Prerequisites

- **Node.js 20+**
- **pnpm 9.15+** (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- Or **Docker** (no Node/pnpm needed)

## Installation

### Option A: One-command bootstrap (recommended)

```sh
npx crewdeck onboard --yes
```

This walks you through setup, configures your environment, and starts Crewdeck.

### Option B: From source

```sh
git clone https://github.com/crewdeck/crewdeck.git
cd crewdeck
pnpm install
pnpm dev
```

### Option C: Docker

```sh
docker compose -f docker-compose.quickstart.yml up -d
```

This starts Crewdeck with an embedded Postgres and persistent data volume. No host dependencies required.

All three options start the dashboard at [http://localhost:3100](http://localhost:3100).

## First Run Walkthrough

### 1. Open the dashboard

Navigate to `http://localhost:3100`. You'll see an empty company list.

### 2. Create your first project (company)

Click **New Company**. Give it a name and a goal — the goal is the north star that every agent and task traces back to. Example:

- **Name:** Acme AI
- **Goal:** Build the #1 AI note-taking app to $1M MRR

### 3. Add your first agent

Inside the company, go to **Agents** and click **New Agent**. Fill in:

| Field | Example |
|-------|---------|
| Name | CEO |
| Role / Title | Chief Executive Officer |
| Adapter | `claude_local` (Claude Code on your machine) |
| Capabilities | Strategic planning, task delegation, company oversight |

### 4. Configure the agent

After creation, open the agent's settings:

- **Adapter config** — set the model, working directory, and any adapter-specific options
- **Heartbeat interval** — how often the agent wakes up (e.g. every 30 minutes). Leave blank for event-driven only.
- **Budget** — monthly spend limit in cents (e.g. `5000` = $50/month). Agent auto-pauses when exceeded.
- **Review gate** — toggle on if you want to approve the agent's work before tasks are marked done.

### 5. Create your first task

Go to the **Tasks** board and click **New Task**:

- **Title:** Define product strategy for Q1
- **Priority:** High
- **Assignee:** CEO agent
- **Project:** (select your project)

The agent will pick up this task on its next heartbeat. You can also manually invoke a heartbeat from the agent's detail page by clicking **Invoke**.

## What happens next

Once assigned, the agent wakes up, checks out the task atomically (no other agent can grab it), does the work, and updates the status. You monitor progress from the dashboard.

From here:
- Add more agents to build out the org chart
- Set up [notifications](/docs/notifications) to get alerts on Telegram or Discord
- Read [Core Concepts](/docs/concepts) to understand how everything fits together
