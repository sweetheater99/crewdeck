import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { heartbeatsApi } from "../api/heartbeats";
import { getUIAdapter, buildTranscript } from "../adapters";
import type { TranscriptEntry } from "../adapters";
import type { HeartbeatRun, HeartbeatRunEvent } from "@crewdeck/shared";
import { cn } from "../lib/utils";
import { formatTokens } from "../lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RunLogViewerProps {
  run: HeartbeatRun;
  adapterType: string;
  /** Max height of the viewer. Defaults to 600px. Pass "none" for unconstrained. */
  maxHeight?: number | "none";
  /** If true, shows a compact version without the invocation card */
  compact?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function RunLogViewer({ run, adapterType, maxHeight = 600, compact = false }: RunLogViewerProps) {
  const [events, setEvents] = useState<HeartbeatRunEvent[]>([]);
  const [logLines, setLogLines] = useState<Array<{ ts: string; stream: "stdout" | "stderr" | "system"; chunk: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(!!run.logRef);
  const [logError, setLogError] = useState<string | null>(null);
  const [logOffset, setLogOffset] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingLogLineRef = useRef("");
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);
  const isLive = run.status === "running" || run.status === "queued";

  function appendLogContent(content: string, finalize = false) {
    if (!content && !finalize) return;
    const combined = `${pendingLogLineRef.current}${content}`;
    const split = combined.split("\n");
    pendingLogLineRef.current = split.pop() ?? "";
    if (finalize && pendingLogLineRef.current) {
      split.push(pendingLogLineRef.current);
      pendingLogLineRef.current = "";
    }

    const parsed: Array<{ ts: string; stream: "stdout" | "stderr" | "system"; chunk: string }> = [];
    for (const line of split) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const raw = JSON.parse(trimmed) as { ts?: unknown; stream?: unknown; chunk?: unknown };
        const stream = raw.stream === "stderr" || raw.stream === "system" ? raw.stream : "stdout";
        const chunk = typeof raw.chunk === "string" ? raw.chunk : "";
        const ts = typeof raw.ts === "string" ? raw.ts : new Date().toISOString();
        if (!chunk) continue;
        parsed.push({ ts, stream, chunk });
      } catch {
        // ignore malformed lines
      }
    }

    if (parsed.length > 0) {
      setLogLines((prev) => [...prev, ...parsed]);
    }
  }

  // Fetch events
  const { data: initialEvents } = useQuery({
    queryKey: ["run-events", run.id],
    queryFn: () => heartbeatsApi.events(run.id, 0, 200),
  });

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      setLoading(false);
    }
  }, [initialEvents]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    const nearTop = el.scrollTop < 32;
    setAtBottom(nearBottom);
    setAtTop(nearTop);
  }, []);

  // Auto-scroll for live runs
  useEffect(() => {
    if (!isLive || !atBottom) return;
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logLines.length, events.length, isLive, atBottom]);

  // Fetch persisted shell log
  useEffect(() => {
    let cancelled = false;
    pendingLogLineRef.current = "";
    setLogLines([]);
    setLogOffset(0);
    setLogError(null);

    if (!run.logRef) {
      setLogLoading(false);
      return () => { cancelled = true; };
    }

    setLogLoading(true);
    const firstLimit =
      typeof run.logBytes === "number" && run.logBytes > 0
        ? Math.min(Math.max(run.logBytes + 1024, 256_000), 2_000_000)
        : 256_000;

    const load = async () => {
      try {
        let offset = 0;
        let first = true;
        while (!cancelled) {
          const result = await heartbeatsApi.log(run.id, offset, first ? firstLimit : 256_000);
          if (cancelled) break;
          appendLogContent(result.content, result.nextOffset === undefined);
          const next = result.nextOffset ?? offset + result.content.length;
          setLogOffset(next);
          offset = next;
          first = false;
          if (result.nextOffset === undefined || isLive) break;
        }
      } catch (err) {
        if (!cancelled) {
          setLogError(err instanceof Error ? err.message : "Failed to load run log");
        }
      } finally {
        if (!cancelled) setLogLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [run.id, run.logRef, run.logBytes, isLive]);

  // Poll for live updates
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      const maxSeq = events.length > 0 ? Math.max(...events.map((e) => e.seq)) : 0;
      try {
        const newEvents = await heartbeatsApi.events(run.id, maxSeq, 100);
        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents]);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run.id, isLive, events]);

  // Poll shell log for running runs
  useEffect(() => {
    if (!isLive || !run.logRef) return;
    const interval = setInterval(async () => {
      try {
        const result = await heartbeatsApi.log(run.id, logOffset, 256_000);
        if (result.content) {
          appendLogContent(result.content, result.nextOffset === undefined);
        }
        if (result.nextOffset !== undefined) {
          setLogOffset(result.nextOffset);
        } else if (result.content.length > 0) {
          setLogOffset((prev) => prev + result.content.length);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run.id, run.logRef, isLive, logOffset]);

  const adapterInvokePayload = useMemo(() => {
    const evt = events.find((e) => e.eventType === "adapter.invoke");
    return asRecord(evt?.payload ?? null);
  }, [events]);

  const adapter = useMemo(() => getUIAdapter(adapterType), [adapterType]);
  const transcript = useMemo(() => buildTranscript(logLines, adapter.parseStdoutLine), [logLines, adapter]);

  if (loading && logLoading) {
    return <div className="text-xs text-muted-foreground p-3">Loading run logs...</div>;
  }

  if (events.length === 0 && logLines.length === 0 && !logError) {
    return <div className="text-xs text-muted-foreground p-3">No log output for this run.</div>;
  }

  const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };

  const levelColors: Record<string, string> = {
    info: "text-zinc-300",
    warn: "text-yellow-400",
    error: "text-red-400",
  };

  const streamColors: Record<string, string> = {
    stdout: "text-zinc-300",
    stderr: "text-red-400",
    system: "text-cyan-400",
  };

  const heightStyle = maxHeight === "none" ? {} : { maxHeight: `${maxHeight}px` };

  return (
    <div className="rounded-lg border border-zinc-700/50 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">
            Transcript ({transcript.length})
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-cyan-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
              </span>
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!atTop && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-zinc-500 hover:text-zinc-300"
              onClick={() => {
                const el = scrollContainerRef.current;
                if (el) el.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
          )}
          {!atBottom && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-zinc-500 hover:text-zinc-300"
              onClick={() => {
                const el = scrollContainerRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              }}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Invocation info (non-compact only) */}
      {!compact && adapterInvokePayload && (
        <div className="px-3 py-2 border-b border-zinc-700/50 bg-zinc-900/80 space-y-1">
          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Invocation</div>
          {typeof adapterInvokePayload.adapterType === "string" && (
            <div className="text-xs text-zinc-400"><span className="text-zinc-500">Adapter: </span>{adapterInvokePayload.adapterType}</div>
          )}
          {typeof adapterInvokePayload.cwd === "string" && (
            <div className="text-xs text-zinc-400 break-all"><span className="text-zinc-500">Dir: </span><span className="font-mono">{adapterInvokePayload.cwd}</span></div>
          )}
          {typeof adapterInvokePayload.command === "string" && (
            <div className="text-xs text-zinc-400 break-all">
              <span className="text-zinc-500">Cmd: </span>
              <span className="font-mono">
                {[
                  adapterInvokePayload.command,
                  ...(Array.isArray(adapterInvokePayload.commandArgs)
                    ? adapterInvokePayload.commandArgs.filter((v): v is string => typeof v === "string")
                    : []),
                ].join(" ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Terminal body */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="bg-zinc-950 p-3 font-mono text-xs space-y-0.5 overflow-y-auto overflow-x-hidden"
        style={heightStyle}
      >
        {transcript.length === 0 && !run.logRef && (
          <div className="text-zinc-600">No persisted transcript for this run.</div>
        )}
        {transcript.map((entry, idx) => {
          const time = new Date(entry.ts).toLocaleTimeString("en-US", timeFormat);
          const grid = "grid grid-cols-[auto_auto_1fr] gap-x-2 items-baseline";
          const tsCell = "text-zinc-600 select-none w-14 text-[10px]";
          const lblCell = "w-16 text-[10px]";
          const contentCell = "min-w-0 whitespace-pre-wrap break-words overflow-hidden";

          if (entry.kind === "assistant") {
            return (
              <div key={`${entry.ts}-assistant-${idx}`} className={cn(grid, "py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-green-400")}>assistant</span>
                <span className={cn(contentCell, "text-green-200")}>{entry.text}</span>
              </div>
            );
          }

          if (entry.kind === "thinking") {
            return (
              <div key={`${entry.ts}-thinking-${idx}`} className={cn(grid, "py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-green-400/60")}>thinking</span>
                <span className={cn(contentCell, "text-green-200/60 italic")}>{entry.text}</span>
              </div>
            );
          }

          if (entry.kind === "user") {
            return (
              <div key={`${entry.ts}-user-${idx}`} className={cn(grid, "py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-zinc-400")}>user</span>
                <span className={cn(contentCell, "text-zinc-300")}>{entry.text}</span>
              </div>
            );
          }

          if (entry.kind === "tool_call") {
            return (
              <div key={`${entry.ts}-tool-${idx}`} className={cn(grid, "gap-y-1 py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-yellow-400")}>tool_call</span>
                <span className="text-yellow-200 min-w-0">{entry.name}</span>
                <pre className="col-span-full md:col-start-3 md:col-span-1 bg-zinc-900 rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap text-zinc-300">
                  {JSON.stringify(entry.input, null, 2)}
                </pre>
              </div>
            );
          }

          if (entry.kind === "tool_result") {
            return (
              <div key={`${entry.ts}-toolres-${idx}`} className={cn(grid, "gap-y-1 py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, entry.isError ? "text-red-400" : "text-purple-400")}>tool_result</span>
                {entry.isError ? <span className="text-red-400 min-w-0">error</span> : <span />}
                <pre className="col-span-full md:col-start-3 md:col-span-1 bg-zinc-900 rounded p-2 text-[11px] overflow-x-auto whitespace-pre-wrap text-zinc-400 max-h-60 overflow-y-auto">
                  {(() => { try { return JSON.stringify(JSON.parse(entry.content), null, 2); } catch { return entry.content; } })()}
                </pre>
              </div>
            );
          }

          if (entry.kind === "init") {
            return (
              <div key={`${entry.ts}-init-${idx}`} className={grid}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-cyan-400")}>init</span>
                <span className={cn(contentCell, "text-cyan-200")}>model: {entry.model}{entry.sessionId ? `, session: ${entry.sessionId}` : ""}</span>
              </div>
            );
          }

          if (entry.kind === "result") {
            return (
              <div key={`${entry.ts}-result-${idx}`} className={cn(grid, "gap-y-1 py-0.5")}>
                <span className={tsCell}>{time}</span>
                <span className={cn(lblCell, "text-cyan-400")}>result</span>
                <span className={cn(contentCell, "text-cyan-200")}>
                  tokens in={formatTokens(entry.inputTokens)} out={formatTokens(entry.outputTokens)} cached={formatTokens(entry.cachedTokens)} cost=${entry.costUsd.toFixed(6)}
                </span>
                {(entry.subtype || entry.isError || entry.errors.length > 0) && (
                  <div className="col-span-full md:col-start-3 md:col-span-1 text-red-400 whitespace-pre-wrap break-words">
                    subtype={entry.subtype || "unknown"} is_error={entry.isError ? "true" : "false"}
                    {entry.errors.length > 0 ? ` errors=${entry.errors.join(" | ")}` : ""}
                  </div>
                )}
                {entry.text && (
                  <div className="col-span-full md:col-start-3 md:col-span-1 whitespace-pre-wrap break-words text-zinc-200">{entry.text}</div>
                )}
              </div>
            );
          }

          // Fallback: stdout/stderr/system
          const rawText = entry.text;
          const label =
            entry.kind === "stderr" ? "stderr" :
            entry.kind === "system" ? "system" :
            "stdout";
          const color =
            entry.kind === "stderr" ? "text-red-400" :
            entry.kind === "system" ? "text-cyan-400" :
            "text-zinc-300";
          return (
            <div key={`${entry.ts}-raw-${idx}`} className={grid}>
              <span className={tsCell}>{time}</span>
              <span className={cn(lblCell, color)}>{label}</span>
              <span className={cn(contentCell, color)}>{rawText}</span>
            </div>
          );
        })}
        {logError && <div className="text-red-400">{logError}</div>}

        {/* Events section */}
        {events.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="mb-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Events ({events.length})</div>
            {events.map((evt) => {
              const color = evt.color
                ?? (evt.level ? levelColors[evt.level] : null)
                ?? (evt.stream ? streamColors[evt.stream] : null)
                ?? "text-zinc-300";

              return (
                <div key={evt.id} className="flex gap-2">
                  <span className="text-zinc-600 shrink-0 select-none w-14 text-[10px]">
                    {new Date(evt.createdAt).toLocaleTimeString("en-US", timeFormat)}
                  </span>
                  <span className={cn("shrink-0 w-14 text-[10px]", evt.stream ? (streamColors[evt.stream] ?? "text-zinc-500") : "text-zinc-500")}>
                    {evt.stream ? `[${evt.stream}]` : ""}
                  </span>
                  <span className={cn("break-all text-[11px]", color)}>
                    {evt.message ?? (evt.payload ? JSON.stringify(evt.payload) : "")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
