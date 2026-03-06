---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `crewdeck run`

One-command bootstrap and start:

```sh
pnpm crewdeck run
```

Does:

1. Auto-onboards if config is missing
2. Runs `crewdeck doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm crewdeck run --instance dev
```

## `crewdeck onboard`

Interactive first-time setup:

```sh
pnpm crewdeck onboard
```

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm crewdeck onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm crewdeck onboard --yes
```

## `crewdeck doctor`

Health checks with optional auto-repair:

```sh
pnpm crewdeck doctor
pnpm crewdeck doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `crewdeck configure`

Update configuration sections:

```sh
pnpm crewdeck configure --section server
pnpm crewdeck configure --section secrets
pnpm crewdeck configure --section storage
```

## `crewdeck env`

Show resolved environment configuration:

```sh
pnpm crewdeck env
```

## `crewdeck allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm crewdeck allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.crewdeck/instances/default/config.json` |
| Database | `~/.crewdeck/instances/default/db` |
| Logs | `~/.crewdeck/instances/default/logs` |
| Storage | `~/.crewdeck/instances/default/data/storage` |
| Secrets key | `~/.crewdeck/instances/default/secrets/master.key` |

Override with:

```sh
CREWDECK_HOME=/custom/home CREWDECK_INSTANCE_ID=dev pnpm crewdeck run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm crewdeck run --data-dir ./tmp/crewdeck-dev
pnpm crewdeck doctor --data-dir ./tmp/crewdeck-dev
```
