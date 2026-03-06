export const type = "claude_local";
export const label = "Claude Code (local)";

export const models = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
];

export const agentConfigurationDoc = `# claude_local agent configuration

Adapter: claude_local

## Authentication

OAuth (recommended): Run \`claude login\` once on the host machine. This uses your
Claude Pro/Max subscription — no API key or env vars needed. The adapter automatically
detects subscription auth when no ANTHROPIC_API_KEY is set.

API Key (alternative): Set ANTHROPIC_API_KEY in the env config for pay-per-use API billing.

## Core fields
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected at runtime
- model (string, optional): Claude model id
- effort (string, optional): reasoning effort passed via --effort (low|medium|high)
- chrome (boolean, optional): pass --chrome when running Claude
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one run
- dangerouslySkipPermissions (boolean, optional): pass --dangerously-skip-permissions to claude
- command (string, optional): defaults to "claude"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables (only needed for API key auth or custom vars)

## Operational fields
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds
`;
