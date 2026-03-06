---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that Crewdeck uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Server host binding |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `CREWDECK_HOME` | `~/.crewdeck` | Base directory for all Crewdeck data |
| `CREWDECK_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `CREWDECK_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `CREWDECK_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `CREWDECK_SECRETS_MASTER_KEY_FILE` | `~/.crewdeck/.../secrets/master.key` | Path to key file |
| `CREWDECK_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `CREWDECK_AGENT_ID` | Agent's unique ID |
| `CREWDECK_COMPANY_ID` | Company ID |
| `CREWDECK_API_URL` | Crewdeck API base URL |
| `CREWDECK_API_KEY` | Short-lived JWT for API auth |
| `CREWDECK_RUN_ID` | Current heartbeat run ID |
| `CREWDECK_TASK_ID` | Issue that triggered this wake |
| `CREWDECK_WAKE_REASON` | Wake trigger reason |
| `CREWDECK_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `CREWDECK_APPROVAL_ID` | Resolved approval ID |
| `CREWDECK_APPROVAL_STATUS` | Approval decision |
| `CREWDECK_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |
