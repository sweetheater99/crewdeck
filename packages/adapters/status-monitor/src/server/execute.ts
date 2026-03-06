import type { AdapterExecutionContext, AdapterExecutionResult } from "@crewdeck/adapter-utils";
import {
  asString,
  asNumber,
  parseObject,
  redactEnvForLogs,
  ensureAbsoluteDirectory,
  ensurePathInEnv,
  runChildProcess,
} from "@crewdeck/adapter-utils/server-utils";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, config, onLog, onMeta } = ctx;

  const command = asString(config.command, "");
  if (!command) throw new Error("Status monitor adapter requires a command");

  const cwd = asString(config.cwd, process.cwd());
  const successPattern = asString(config.successPattern, "");
  const timeoutSec = asNumber(config.timeoutSec, 30);
  const graceSec = asNumber(config.graceSec, 10);

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }

  // Validate cwd if specified in config
  const configuredCwd = asString(config.cwd, "");
  if (configuredCwd) {
    await ensureAbsoluteDirectory(cwd);
  }

  if (onMeta) {
    await onMeta({
      adapterType: "status_monitor",
      command: "bash",
      cwd,
      commandArgs: ["-c", command],
      env: redactEnvForLogs(env),
    });
  }

  const proc = await runChildProcess(runId, "bash", ["-c", command], {
    cwd,
    env,
    timeoutSec,
    graceSec,
    onLog,
  });

  const stdout = proc.stdout.trim();
  const stderr = proc.stderr.trim();
  const combinedOutput = [stdout, stderr].filter(Boolean).join("\n");

  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `Status check timed out after ${timeoutSec}s`,
      errorCode: "timeout",
      billingType: "unknown",
      costUsd: 0,
      summary: `TIMEOUT: ${command}`,
      resultJson: { stdout: proc.stdout, stderr: proc.stderr },
    };
  }

  // Determine success: either by successPattern regex or exit code
  let isHealthy: boolean;
  if (successPattern) {
    try {
      const regex = new RegExp(successPattern);
      isHealthy = regex.test(stdout);
    } catch {
      // If regex is invalid, fall back to exit code
      isHealthy = (proc.exitCode ?? 1) === 0;
    }
  } else {
    isHealthy = (proc.exitCode ?? 1) === 0;
  }

  const statusLabel = isHealthy ? "HEALTHY" : "UNHEALTHY";
  const summary = combinedOutput
    ? `${statusLabel}: ${combinedOutput.slice(0, 500)}`
    : `${statusLabel}: exit code ${proc.exitCode ?? -1}`;

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    errorMessage: isHealthy ? null : `Status check failed (exit code ${proc.exitCode ?? -1})`,
    billingType: "unknown",
    costUsd: 0,
    summary,
    resultJson: {
      stdout: proc.stdout,
      stderr: proc.stderr,
      healthy: isHealthy,
    },
  };
}
