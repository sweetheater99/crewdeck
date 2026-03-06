import type { UIAdapterModule } from "../types";
import { parseStatusMonitorStdoutLine } from "@crewdeck/adapter-status-monitor/ui";
import { buildStatusMonitorConfig } from "@crewdeck/adapter-status-monitor/ui";
import { StatusMonitorConfigFields } from "./config-fields";

export const statusMonitorUIAdapter: UIAdapterModule = {
  type: "status_monitor",
  label: "Status Monitor",
  parseStdoutLine: parseStatusMonitorStdoutLine,
  ConfigFields: StatusMonitorConfigFields,
  buildAdapterConfig: buildStatusMonitorConfig,
};
