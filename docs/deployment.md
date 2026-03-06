---
title: Deployment
summary: Run Crewdeck in Docker, from source, or on a remote machine
---

## Docker (Recommended)

The simplest way to run Crewdeck in production. Single container with embedded Postgres.

### Quick start

```sh
docker compose -f docker-compose.quickstart.yml up -d
```

This runs Crewdeck on port 3100 with a persistent data volume at `/crewdeck`.

### Custom configuration

Use the full `docker-compose.yml` for more control:

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: crewdeck
      POSTGRES_PASSWORD: crewdeck
      POSTGRES_DB: crewdeck
    volumes:
      - pgdata:/var/lib/postgresql/data

  crewdeck:
    build: .
    ports:
      - "3100:3100"
    environment:
      DATABASE_URL: postgres://crewdeck:crewdeck@db:5432/crewdeck
      HOST: "0.0.0.0"
      SERVE_UI: "true"
    depends_on:
      - db
    volumes:
      - crewdeck-data:/crewdeck
    restart: unless-stopped

volumes:
  pgdata:
  crewdeck-data:
```

### Data volumes

| Volume | Contents |
|--------|----------|
| `crewdeck-data` (`/crewdeck`) | Embedded Postgres data, secrets key, local file storage, backups |
| `pgdata` (external Postgres) | Database files when using a separate Postgres container |

## From Source

For development or when you want full control.

```sh
git clone https://github.com/crewdeck/crewdeck.git
cd crewdeck
pnpm install
pnpm dev          # Development mode (API + UI with hot reload)
pnpm build        # Production build
node server/dist/index.js  # Run production build
```

Crewdeck creates an embedded PostgreSQL instance automatically — no database setup needed for local use.

## Remote Access via Tailscale

If you're running Crewdeck on a home machine or server and want to access it from your phone or laptop on the go:

1. Install [Tailscale](https://tailscale.com/) on both your Crewdeck machine and your mobile device
2. Start Crewdeck with `HOST=0.0.0.0` so it listens on all interfaces
3. Access via Tailscale IP: `http://100.x.y.z:3100`

No port forwarding, no public exposure, no VPN setup. Tailscale handles encrypted point-to-point connectivity.

For hostname access, enable Tailscale MagicDNS and add your machine's Tailscale hostname to `CREWDECK_ALLOWED_HOSTNAMES`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` for all interfaces) |
| `PORT` | `3100` | HTTP port |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string. Omit to use embedded Postgres. |
| `SERVE_UI` | `true` | Serve the web UI from the server |
| `CREWDECK_HOME` | `~/.crewdeck` | Base directory for all Crewdeck data |
| `CREWDECK_DEPLOYMENT_MODE` | `local_trusted` | `local_trusted` (no auth) or `authenticated` |
| `CREWDECK_DEPLOYMENT_EXPOSURE` | `private` | `private` or `public` |
| `CREWDECK_ALLOWED_HOSTNAMES` | (none) | Comma-separated hostnames allowed in `authenticated` + `private` mode |
| `CREWDECK_SECRETS_PROVIDER` | `local_encrypted` | `local_encrypted`, `aws_secrets_manager`, `vault` |
| `CREWDECK_SECRETS_MASTER_KEY_FILE` | (auto) | Path to encryption key file |
| `CREWDECK_SECRETS_STRICT_MODE` | `false` | Fail if secrets can't be decrypted |
| `CREWDECK_STORAGE_PROVIDER` | `local_disk` | `local_disk` or `s3` |
| `CREWDECK_STORAGE_LOCAL_DIR` | (auto) | Local disk storage directory |
| `CREWDECK_STORAGE_S3_BUCKET` | `crewdeck` | S3 bucket name |
| `CREWDECK_STORAGE_S3_REGION` | `us-east-1` | S3 region |
| `CREWDECK_STORAGE_S3_ENDPOINT` | (none) | S3-compatible endpoint (MinIO, R2, etc.) |
| `CREWDECK_DB_BACKUP_ENABLED` | `true` | Enable automatic database backups |
| `CREWDECK_DB_BACKUP_INTERVAL_MINUTES` | `60` | Backup frequency |
| `CREWDECK_DB_BACKUP_RETENTION_DAYS` | `30` | How long to keep backups |
| `CREWDECK_DB_BACKUP_DIR` | (auto) | Backup directory |
| `CREWDECK_ENABLE_COMPANY_DELETION` | (varies) | Allow company deletion. Default `true` in `local_trusted` mode. |
| `HEARTBEAT_SCHEDULER_ENABLED` | `true` | Enable the heartbeat scheduler |
| `HEARTBEAT_SCHEDULER_INTERVAL_MS` | `30000` | Scheduler polling interval (min 10000) |
| `OPENAI_API_KEY` | (none) | For Codex adapter |
| `ANTHROPIC_API_KEY` | (none) | For Claude adapter |

## Database Options

### Embedded Postgres (default)

No configuration needed. Crewdeck downloads and runs a PostgreSQL instance inside its data directory. Data persists in `CREWDECK_HOME`.

Good for: solo use, local development, Docker single-container deploys.

### Docker Postgres

Use the full `docker-compose.yml` to run Postgres in a separate container. Set `DATABASE_URL` to point to it.

Good for: production Docker deploys where you want Postgres managed separately.

### External Postgres

Point `DATABASE_URL` at any PostgreSQL 15+ instance:

```sh
DATABASE_URL=postgres://user:pass@your-host:5432/crewdeck pnpm dev
```

Good for: production deploys with managed databases (RDS, Supabase, Neon, etc.).

## Backups

Crewdeck automatically backs up the embedded Postgres database on a schedule (default: every 60 minutes, retained for 30 days).

Backup location: `CREWDECK_HOME/backups/` (or `CREWDECK_DB_BACKUP_DIR`).

For external Postgres, use your database provider's backup tooling instead.

Manual backup:

```sh
pnpm db:backup
```

To restore, stop Crewdeck and restore the Postgres data directory from a backup snapshot, or use `pg_restore` for SQL dumps.
