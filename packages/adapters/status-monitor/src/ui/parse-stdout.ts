import type { TranscriptEntry } from "@crewdeck/adapter-utils";

export function parseStatusMonitorStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return [{ kind: "stdout", ts, text: line }];
}
