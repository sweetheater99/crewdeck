import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@crewdeck/adapter-utils";
import {
  asString,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
} from "@crewdeck/adapter-utils/server-utils";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "");
  const cwd = asString(config.cwd, process.cwd());

  if (!command) {
    checks.push({
      code: "status_monitor_command_missing",
      level: "error",
      message: "Status monitor adapter requires a command.",
      hint: "Set adapterConfig.command to a shell command (e.g. 'systemctl is-active myservice').",
    });
  } else {
    checks.push({
      code: "status_monitor_command_present",
      level: "info",
      message: `Configured command: ${command}`,
    });
  }

  // Validate cwd
  const configuredCwd = asString(config.cwd, "");
  if (configuredCwd) {
    try {
      await ensureAbsoluteDirectory(cwd);
      checks.push({
        code: "status_monitor_cwd_valid",
        level: "info",
        message: `Working directory is valid: ${cwd}`,
      });
    } catch (err) {
      checks.push({
        code: "status_monitor_cwd_invalid",
        level: "error",
        message: err instanceof Error ? err.message : "Invalid working directory",
        detail: cwd,
      });
    }
  }

  // Validate that bash is available (we always use bash -c to run commands)
  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  try {
    await ensureCommandResolvable("bash", cwd, runtimeEnv);
    checks.push({
      code: "status_monitor_bash_resolvable",
      level: "info",
      message: "bash is available for running commands.",
    });
  } catch (err) {
    checks.push({
      code: "status_monitor_bash_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "bash is not available",
      hint: "Status monitor requires bash to execute commands.",
    });
  }

  // Validate successPattern if provided
  const successPattern = asString(config.successPattern, "");
  if (successPattern) {
    try {
      new RegExp(successPattern);
      checks.push({
        code: "status_monitor_pattern_valid",
        level: "info",
        message: `Success pattern is a valid regex: ${successPattern}`,
      });
    } catch {
      checks.push({
        code: "status_monitor_pattern_invalid",
        level: "error",
        message: `Success pattern is not a valid regex: ${successPattern}`,
        hint: "Fix the successPattern to be a valid regular expression.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
