import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveCrewdeckHomeDir,
  resolveCrewdeckInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to ~/.crewdeck and default instance", () => {
    delete process.env.CREWDECK_HOME;
    delete process.env.CREWDECK_INSTANCE_ID;

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".crewdeck"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".crewdeck", "instances", "default", "config.json"));
  });

  it("supports CREWDECK_HOME and explicit instance ids", () => {
    process.env.CREWDECK_HOME = "~/crewdeck-home";

    const home = resolveCrewdeckHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "crewdeck-home"));
    expect(resolveCrewdeckInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveCrewdeckInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
