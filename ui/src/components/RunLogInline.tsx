/**
 * A lightweight inline log viewer that only needs a runId.
 * Fetches events and logs directly and renders a terminal-style view.
 * Used in issue detail for expandable run log viewing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { heartbeatsApi } from "../api/heartbeats";
import type { HeartbeatRunEvent } from "@crewdeck/shared";
import { cn } from "../lib/utils";
import { ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RunLogInlineProps {
  runId: string;
  /** Max height in px. Default: 400 */
  maxHeight?: number;
}

export function RunLogInline({ runId, maxHeight = 400 }: RunLogInlineProps) {
  const [events, setEvents] = useState<HeartbeatRunEvent[]>([]);
  const [logContent, setLogContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [evts, logResult] = await Promise.all([
          heartbeatsApi.events(runId, 0, 200).catch(() => [] as HeartbeatRunEvent[]),
          heartbeatsApi.log(runId, 0, 512_000).catch(() => null),
        ]);
        if (cancelled) return;
        setEvents(evts);
        if (logResult?.content) setLogContent(logResult.content);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [runId]);

  const logLines = useMemo(() => {
    if (!logContent) return [];
    const lines: Array<{ ts: string; stream: string; chunk: string }> = [];
    for (const raw of logContent.split("\n")) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as { ts?: string; stream?: string; chunk?: string };
        if (parsed.chunk) {
          lines.push({
            ts: parsed.ts ?? new Date().toISOString(),
            stream: parsed.stream ?? "stdout",
            chunk: parsed.chunk,
          });
        }
      } catch {
        // skip malformed
      }
    }
    return lines;
  }, [logContent]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 32);
    setAtTop(el.scrollTop < 32);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading logs...
      </div>
    );
  }

  if (error) {
    return <div className="p-3 text-xs text-red-500">{error}</div>;
  }

  if (events.length === 0 && logLines.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground">No log output for this run.</div>;
  }

  const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };

  const streamColor = (stream: string) => {
    if (stream === "stderr") return "text-red-400";
    if (stream === "system") return "text-cyan-400";
    return "text-zinc-300";
  };

  return (
    <div className="rounded-lg border border-zinc-700/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-900 border-b border-zinc-700/50">
        <span className="text-[10px] font-medium text-zinc-500">
          {logLines.length > 0 ? `${logLines.length} log entries` : `${events.length} events`}
        </span>
        <div className="flex items-center gap-1">
          {!atTop && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-zinc-500 hover:text-zinc-300"
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
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
                const el = scrollRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              }}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-zinc-950 p-3 font-mono text-xs space-y-0.5 overflow-y-auto overflow-x-hidden"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {logLines.map((line, idx) => (
          <div key={idx} className="flex gap-2">
            <span className="text-zinc-600 shrink-0 select-none w-14 text-[10px]">
              {new Date(line.ts).toLocaleTimeString("en-US", timeFormat)}
            </span>
            <span className={cn("min-w-0 whitespace-pre-wrap break-words", streamColor(line.stream))}>
              {line.chunk}
            </span>
          </div>
        ))}
        {logLines.length === 0 && events.map((evt) => (
          <div key={evt.id} className="flex gap-2">
            <span className="text-zinc-600 shrink-0 select-none w-14 text-[10px]">
              {new Date(evt.createdAt).toLocaleTimeString("en-US", timeFormat)}
            </span>
            <span className={cn(
              "min-w-0 whitespace-pre-wrap break-words text-[11px]",
              evt.stream ? streamColor(evt.stream) : "text-zinc-300",
            )}>
              {evt.message ?? (evt.payload ? JSON.stringify(evt.payload) : "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
