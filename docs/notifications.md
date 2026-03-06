---
title: Notifications
summary: Set up Telegram, Discord, and webhook notifications for your AI company
---

Crewdeck sends notifications when important events happen — task completions, agent errors, budget alerts, approval requests. You configure **channels** (where to send) and **rules** (what to send).

## Supported Channels

| Channel | Config required |
|---------|----------------|
| **Telegram** | Bot token + chat ID |
| **Discord** | Webhook URL |
| **Webhook** | URL + optional HMAC secret |

## Setting Up Telegram

1. **Create a bot:** Message [@BotFather](https://t.me/BotFather) on Telegram. Send `/newbot`, follow the prompts, and copy the **bot token**.

2. **Get your chat ID:** Send a message to your new bot, then visit `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`. Find `chat.id` in the response.

3. **Add the channel in Crewdeck:** Go to your project's **Settings > Notifications > Add Channel**:
   - Channel type: `telegram`
   - Bot token: paste your token
   - Chat ID: paste your chat ID

4. **Test it:** Click the **Test** button on the channel. You should receive a test message in Telegram.

### Telegram inline buttons

When Crewdeck sends notifications about tasks needing review, it includes inline action buttons:
- **Approve** — approve the task directly from Telegram
- **Retry** — send the task back to the agent
- **Pause** — pause the agent

For inline buttons to work, set up a Telegram webhook. Crewdeck exposes a callback endpoint at `/api/telegram/callback/:channelId` that Telegram calls when a button is pressed.

## Setting Up Discord

1. **Create a webhook:** In your Discord server, go to **Channel Settings > Integrations > Webhooks > New Webhook**. Copy the webhook URL.

2. **Add the channel in Crewdeck:** Go to **Settings > Notifications > Add Channel**:
   - Channel type: `discord`
   - Webhook URL: paste the URL

3. **Test it:** Click **Test**. A message should appear in your Discord channel.

## Setting Up a Generic Webhook

For custom integrations (Slack via webhook, PagerDuty, your own services):

1. **Add the channel:**
   - Channel type: `webhook`
   - URL: your endpoint
   - Secret (optional): an HMAC secret. Crewdeck signs payloads with `X-Crewdeck-Signature` header using HMAC-SHA256.

2. **Payload format:**
   ```json
   {
     "eventType": "task.completed",
     "payload": { ... },
     "timestamp": "2026-03-06T10:00:00.000Z"
   }
   ```

## Notification Rules

Channels receive notifications based on **rules**. Each rule pairs an event type with a channel.

Go to **Settings > Notifications > Rules > Add Rule**:
- **Channel:** which channel to send to
- **Event type:** which event triggers the notification (e.g. `task.completed`, `agent.error`, `budget.exceeded`, `approval.requested`)
- **Filter** (optional): JSON filter to narrow by project, agent, etc.
- **Enabled:** toggle on/off

You can have multiple rules per channel, and multiple channels per event type.

### Common event types

| Event | When it fires |
|-------|--------------|
| `task.completed` | A task moves to `done` |
| `task.review_requested` | A task enters `in_review` |
| `agent.error` | An agent heartbeat fails |
| `agent.paused` | An agent is paused (manual or budget) |
| `budget.exceeded` | Agent or project budget limit hit |
| `approval.requested` | An agent requests board approval |
| `heartbeat.completed` | A heartbeat run finishes |

## Daily Digest

Each channel can optionally send a **daily digest** — a summary of the day's activity.

Configure on the channel:
- **Digest enabled:** `true`
- **Digest time:** e.g. `09:00`
- **Digest timezone:** e.g. `Asia/Kolkata` or `America/New_York`

The digest includes: tasks completed, tasks created, costs incurred, agents active, and any errors.
