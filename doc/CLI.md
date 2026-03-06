# CLI Reference

Crewdeck CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm crewdeck --help
```

First-time local bootstrap + run:

```sh
pnpm crewdeck run
```

Choose local instance:

```sh
pnpm crewdeck run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `crewdeck onboard` and `crewdeck configure --section server` set deployment mode in config
- runtime can override mode with `CREWDECK_DEPLOYMENT_MODE`
- `crewdeck run` and `crewdeck doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm crewdeck allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.crewdeck`:

```sh
pnpm crewdeck run --data-dir ./tmp/crewdeck-dev
pnpm crewdeck issue list --data-dir ./tmp/crewdeck-dev
```

## Context Profiles

Store local defaults in `~/.crewdeck/context.json`:

```sh
pnpm crewdeck context set --api-base http://localhost:3100 --company-id <company-id>
pnpm crewdeck context show
pnpm crewdeck context list
pnpm crewdeck context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm crewdeck context set --api-key-env-var-name CREWDECK_API_KEY
export CREWDECK_API_KEY=...
```

## Company Commands

```sh
pnpm crewdeck company list
pnpm crewdeck company get <company-id>
pnpm crewdeck company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm crewdeck company delete PAP --yes --confirm PAP
pnpm crewdeck company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `CREWDECK_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `CREWDECK_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm crewdeck issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm crewdeck issue get <issue-id-or-identifier>
pnpm crewdeck issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm crewdeck issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm crewdeck issue comment <issue-id> --body "..." [--reopen]
pnpm crewdeck issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm crewdeck issue release <issue-id>
```

## Agent Commands

```sh
pnpm crewdeck agent list --company-id <company-id>
pnpm crewdeck agent get <agent-id>
```

## Approval Commands

```sh
pnpm crewdeck approval list --company-id <company-id> [--status pending]
pnpm crewdeck approval get <approval-id>
pnpm crewdeck approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm crewdeck approval approve <approval-id> [--decision-note "..."]
pnpm crewdeck approval reject <approval-id> [--decision-note "..."]
pnpm crewdeck approval request-revision <approval-id> [--decision-note "..."]
pnpm crewdeck approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm crewdeck approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm crewdeck activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm crewdeck dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm crewdeck heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.crewdeck/instances/default`:

- config: `~/.crewdeck/instances/default/config.json`
- embedded db: `~/.crewdeck/instances/default/db`
- logs: `~/.crewdeck/instances/default/logs`
- storage: `~/.crewdeck/instances/default/data/storage`
- secrets key: `~/.crewdeck/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
CREWDECK_HOME=/custom/home CREWDECK_INSTANCE_ID=dev pnpm crewdeck run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm crewdeck configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
