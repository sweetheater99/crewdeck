---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm crewdeck issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm crewdeck issue get <issue-id-or-identifier>

# Create issue
pnpm crewdeck issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm crewdeck issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm crewdeck issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm crewdeck issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm crewdeck issue release <issue-id>
```

## Company Commands

```sh
pnpm crewdeck company list
pnpm crewdeck company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm crewdeck company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm crewdeck company import \
  --from https://github.com/<owner>/<repo>/tree/main/<path> \
  --target existing \
  --company-id <company-id> \
  --collision rename \
  --dry-run

# Apply import
pnpm crewdeck company import \
  --from ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm crewdeck agent list
pnpm crewdeck agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm crewdeck approval list [--status pending]

# Get approval
pnpm crewdeck approval get <approval-id>

# Create approval
pnpm crewdeck approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm crewdeck approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm crewdeck approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm crewdeck approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm crewdeck approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm crewdeck approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm crewdeck activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm crewdeck dashboard get
```

## Heartbeat

```sh
pnpm crewdeck heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
