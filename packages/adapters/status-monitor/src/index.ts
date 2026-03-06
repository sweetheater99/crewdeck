export const type = "status_monitor";
export const label = "Status Monitor";

export const models: { id: string; label: string }[] = [];

export const agentConfigurationDoc = `# status_monitor agent configuration

Adapter: status_monitor

Runs a shell command and reports its output as a health check.
Designed for existing cron-based projects that run independently
and need to report status into the Crewdeck dashboard.

Core fields:
- command (string, required): shell command to execute (e.g. "systemctl is-active myservice && tail -5 /var/log/myservice.log")
- cwd (string, optional): absolute working directory for the command
- successPattern (string, optional): regex pattern to match against stdout for success (default: exit code 0 = healthy)
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds (default: 30)
- graceSec (number, optional): SIGTERM grace period in seconds (default: 10)
`;
