<p align="center">
  <h1 align="center">Crewdeck</h1>
  <p align="center"><strong>Autopilot for solo AI companies</strong></p>
  <p align="center">Your agents work while you sleep. Wake up to results.</p>
</p>

<p align="center">
  <a href="https://github.com/crewdeck/crewdeck/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://github.com/crewdeck/crewdeck/stargazers"><img src="https://img.shields.io/github/stars/crewdeck/crewdeck?style=flat" alt="Stars" /></a>
</p>

## What is Crewdeck?

A lightweight control plane for solo founders running AI agents. Set up your agents, define tasks and dependencies, set budgets -- then step away. Crewdeck orchestrates everything and sends you a morning summary of what happened.

If you're a solo founder with 5-20 AI agents and you've lost track of what they're all doing -- Crewdeck is for you.

## Features

<table>
<tr>
<td align="center" width="33%">
<h3>Task Dependencies</h3>
Chain tasks so agents auto-start when blockers resolve. "Build API" finishes, "Build UI" kicks off.
</td>
<td align="center" width="33%">
<h3>Smart Failure Handling</h3>
Retry, reassign to a backup agent, or escalate to you. No silent failures at 3am.
</td>
<td align="center" width="33%">
<h3>Review Gates</h3>
Trust new agents less, proven agents more. Set approval requirements per agent or task type.
</td>
</tr>
<tr>
<td align="center">
<h3>Notifications</h3>
Telegram, Discord, webhooks. Get pinged when it matters. Act from your phone.
</td>
<td align="center">
<h3>Daily Digest</h3>
"Here's what happened overnight." One summary, every morning, no dashboard required.
</td>
<td align="center">
<h3>Performance Metrics</h3>
Who's productive, who's stuck, what it costs. Per-agent budgets so nothing runs away.
</td>
</tr>
</table>

**Plus:** Inter-agent messaging, shared knowledge base, searchable run logs, mobile dashboard.

## Quickstart

### Docker (recommended)

```bash
docker run -p 3100:3100 -v crewdeck-data:/root/.crewdeck crewdeck/crewdeck
```

### From source

```bash
git clone https://github.com/crewdeck/crewdeck.git
cd crewdeck
pnpm install
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100). An embedded PostgreSQL database is created automatically.

> **Requirements:** Node.js 20+, pnpm 9.15+

## How It Works

1. **Create a project** and add agents (Claude Code, Codex, OpenClaw, Cursor, anything with a heartbeat)
2. **Create tasks with dependencies** -- "Build API" -> "Build UI" -> "Write tests"
3. **Agents execute on heartbeat schedules.** Failures auto-retry or reassign to backup agents.
4. **You get notified.** Telegram pings for urgent stuff, daily digest for everything else. Approve reviews from your phone.

## Works With

<div align="center">
<table>
  <tr>
    <td align="center"><img src="doc/assets/logos/claude.svg" width="32" alt="Claude" /><br/><sub>Claude Code</sub></td>
    <td align="center"><img src="doc/assets/logos/codex.svg" width="32" alt="Codex" /><br/><sub>Codex</sub></td>
    <td align="center"><img src="doc/assets/logos/openclaw.svg" width="32" alt="OpenClaw" /><br/><sub>OpenClaw</sub></td>
    <td align="center"><img src="doc/assets/logos/cursor.svg" width="32" alt="Cursor" /><br/><sub>Cursor</sub></td>
    <td align="center"><img src="doc/assets/logos/bash.svg" width="32" alt="Bash" /><br/><sub>Bash</sub></td>
    <td align="center"><img src="doc/assets/logos/http.svg" width="32" alt="HTTP" /><br/><sub>HTTP</sub></td>
  </tr>
</table>
</div>

If it can receive a heartbeat, it works.

## Architecture

Crewdeck is a **Node.js server + React dashboard** backed by embedded PostgreSQL. One process, one port, no external dependencies.

- **Backend:** Node.js, Express, Drizzle ORM
- **Frontend:** React, Vite
- **Database:** Embedded PostgreSQL (or bring your own)
- **Agents:** Communicate via heartbeat protocol over HTTP

## Development

```bash
pnpm dev              # Full dev (API + UI)
pnpm dev:server       # Server only
pnpm build            # Build all
pnpm typecheck        # Type checking
pnpm test:run         # Run tests
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
```

## FAQ

**Is this like Paperclip?**
Crewdeck is a fork of Paperclip, refocused for solo founders instead of enterprise teams.

**Do I need to run this 24/7?**
Run it on a home server, Raspberry Pi, or cheap VPS. Docker makes it easy. Your agents work while the server is up.

**How much does it cost?**
Free and open source. You pay for the AI APIs your agents use.

**Can I run multiple projects?**
Yes. One deployment handles as many projects as you need, with isolated data.

## License

MIT

[![Star History Chart](https://api.star-history.com/image?repos=crewdeck/crewdeck&type=date&legend=top-left)](https://www.star-history.com/?repos=crewdeck%2Fcrewdeck&type=date&legend=top-left)
