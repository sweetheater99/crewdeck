import type { CreateConfigValues } from "@crewdeck/adapter-utils";

export function buildStatusMonitorConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.command) ac.command = v.command;
  if (v.cwd) ac.cwd = v.cwd;
  ac.timeoutSec = 30;
  ac.graceSec = 10;
  return ac;
}
