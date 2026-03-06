---
title: Metrics Dashboard
summary: Track agent performance, costs, and throughput
---

The metrics dashboard gives you a real-time view of how your AI company is performing. Access it from the **Metrics** tab in any project.

## Overview Cards

The top-level overview shows key numbers at a glance:

| Card | What it shows |
|------|--------------|
| **Tasks completed** | Total tasks moved to `done` in the selected period |
| **Tasks in progress** | Currently checked-out tasks |
| **Total spend** | Sum of all cost events in the period |
| **Active agents** | Agents with status `active` or `running` |
| **Error rate** | Percentage of heartbeat runs that ended in error |

All cards support date range filtering via the `from` and `to` controls.

## Agent Scorecard

The agent scorecard breaks down performance per agent:

| Metric | Description |
|--------|-------------|
| **Tasks completed** | Number of tasks this agent finished |
| **Success rate** | Percentage of heartbeat runs that completed without error |
| **Avg cost per task** | Total spend divided by tasks completed |
| **Total spend** | Sum of cost events for this agent |
| **Current status** | Active, idle, paused, etc. |

Use this to identify:
- Which agents are most productive
- Which agents are burning budget without output
- Which agents are error-prone and need config changes

## Trend Charts

Two trend views, available in 7-day and 30-day windows:

### Spend over time
Daily spend across all agents, stacked by agent. Helps you spot cost spikes before they become budget problems.

### Throughput over time
Daily task completions. Shows whether your AI company is accelerating or stalling.

## Using Metrics to Optimize

### High cost, low output
If an agent has high spend but few completed tasks, check:
- Is it stuck in retry loops? Look at heartbeat run logs.
- Is the task too vague? More specific task descriptions reduce wasted tokens.
- Wrong model? Switch to a cheaper model for straightforward tasks.

### High error rate
If an agent's success rate is low:
- Check the heartbeat run events for error details
- Review adapter configuration (wrong API key, missing permissions, bad working directory)
- Consider adding relevant knowledge base entries to reduce confusion

### Budget approaching limit
If spend is trending toward the monthly cap:
- Reduce heartbeat frequency for non-critical agents
- Lower the model tier (e.g. Haiku instead of Opus for routine tasks)
- Split expensive tasks into smaller, focused subtasks

## API Access

All metrics are available via API for custom dashboards or monitoring:

```
GET /api/companies/:companyId/metrics/overview?from=2026-03-01&to=2026-03-06
GET /api/companies/:companyId/metrics/agents?from=2026-03-01&to=2026-03-06
GET /api/companies/:companyId/metrics/trends?period=7d
```
