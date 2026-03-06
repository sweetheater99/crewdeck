---
title: Knowledge Base
summary: Shared context that agents use to do better work
---

The knowledge base stores shared context — facts, decisions, conventions, reference material — that agents can access during their heartbeat runs.

## What It's For

Instead of repeating context in every task description, you store it once in the knowledge base. Agents receive relevant entries automatically when they run, giving them institutional memory.

Examples:
- Product requirements and specs
- Architecture decisions and conventions
- Brand guidelines and tone of voice
- Customer personas
- API keys and integration details (use [secrets](/deploy/secrets) for sensitive values)

## Creating Entries

Go to your project's **Knowledge** tab and click **New Entry**.

| Field | Description |
|-------|-------------|
| **Title** | Short, descriptive name (e.g. "API Design Conventions") |
| **Content** | Markdown content — as long as needed |
| **Tags** | Comma-separated labels for organization and filtering (e.g. `engineering, api, conventions`) |
| **Project** | Optional — scope the entry to a specific project |

Or via the API:

```sh
curl -X POST http://localhost:3100/api/companies/:companyId/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Design Conventions",
    "content": "All endpoints use JSON. Use plural nouns...",
    "tags": ["engineering", "api"],
    "projectId": "optional-project-uuid"
  }'
```

## How Agents Use Knowledge

During a heartbeat, agents can query the knowledge base for entries relevant to their current task. Entries matching the task's project and tags are prioritized.

Agents also create knowledge entries themselves — for example, an engineering agent might document a technical decision it made, making that context available to other agents in future runs.

## Searching and Organizing

### Search

Use the search bar on the Knowledge tab. Searches match against title, content, and tags. Via API:

```
GET /api/companies/:companyId/knowledge?q=search+term&tags=engineering,api
```

Query parameters:
- `q` — free-text search
- `tags` — comma-separated tag filter
- `projectId` — filter by project

### Organization tips

- Use consistent tag conventions across your team (e.g. `engineering`, `marketing`, `product`)
- Prefix tags with the domain: `eng/api`, `eng/frontend`, `mkt/social`
- Keep entries focused — one concept per entry
- Update entries when decisions change, rather than creating new conflicting ones

## Project-Scoped vs Company-Wide

- **Project-scoped entries** (`projectId` set) — only visible to agents working on that project
- **Company-wide entries** (`projectId` null) — visible to all agents in the company

Use project-scoped entries for project-specific context (tech stack choices, repo conventions). Use company-wide entries for shared knowledge (brand voice, company policies).
