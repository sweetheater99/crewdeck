import fs from "node:fs";
import { crewdeckConfigSchema, type CrewdeckConfig } from "@crewdeck/shared";
import { resolveCrewdeckConfigPath } from "./paths.js";

export function readConfigFile(): CrewdeckConfig | null {
  const configPath = resolveCrewdeckConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return crewdeckConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
