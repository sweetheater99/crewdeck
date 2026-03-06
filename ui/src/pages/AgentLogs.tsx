import { useMemo, useState } from "react";
import { useParams, Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { heartbeatsApi } from "../api/heartbeats";
import { agentsApi } from "../api/agents";
import { activityApi } from "../api/activity";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime, formatTokens, formatDate } from "../lib/utils";
import { agentRouteRef } from "../lib/utils";
import { StatusBadge } from "../components/StatusBadge";
import { RunLogViewer } from "../components/RunLogViewer";
import { PageSkeleton } from "../components/PageSkeleton";
import type { HeartbeatRun } from "@crewdeck/shared";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  Loader2,
  Slash,
  ChevronRight,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

type StatusFilter = "all" | "succeeded" | "failed" | "running";
type DateRange = "24h" | "7d" | "30d" | "all";

const runStatusIcons: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  succeeded: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
  failed: { icon: XCircle, color: "text-red-600 dark:text-red-400" },
  running: { icon: Loader2, color: "text-cyan-600 dark:text-cyan-400" },
  queued: { icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
  timed_out: { icon: Timer, color: "text-orange-600 dark:text-orange-400" },
  cancelled: { icon: Slash, color: "text-neutral-500 dark:text-neutral-400" },
};

const sourceLabels: Record<string, string> = {
  timer: "Timer",
  assignment: "Assignment",
  on_demand: "On-demand",
  automation: "Automation",
};

function usageNumber(usage: Record<string, unknown> | null, ...keys: string[]) {
  if (!usage) return 0;
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function runCost(run: HeartbeatRun) {
  const usage = (run.usageJson ?? null) as Record<string, unknown> | null;
  const result = (run.resultJson ?? null) as Record<string, unknown> | null;
  return (
    usageNumber(usage, "costUsd", "cost_usd", "total_cost_usd") ||
    usageNumber(result, "total_cost_usd", "cost_usd", "costUsd")
  );
}

function runDuration(run: HeartbeatRun): number | null {
  if (!run.startedAt || !run.finishedAt) return null;
  return Math.round(
    (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000,
  );
}

function formatDuration(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${sec}s`;
}

function issueTitle(ctx: Record<string, unknown> | null): string | null {
  if (!ctx) return null;
  const title = ctx.issueTitle ?? ctx.title;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

function issueId(ctx: Record<string, unknown> | null): string | null {
  if (!ctx) return null;
  const id = ctx.issueId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export function AgentLogs() {
  const { agentId } = useParams<{ agentId: string; companyPrefix?: string }>();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: queryKeys.agents.detail(agentId!),
    queryFn: () => agentsApi.get(agentId!),
    enabled: !!agentId,
  });

  const resolvedCompanyId = agent?.companyId ?? selectedCompanyId;
  const canonicalAgentRef = agent ? agentRouteRef(agent) : agentId ?? "";

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: queryKeys.heartbeats(resolvedCompanyId!, agent?.id ?? undefined),
    queryFn: () => heartbeatsApi.list(resolvedCompanyId!, agent?.id ?? undefined, 500),
    enabled: !!resolvedCompanyId && !!agent,
  });

  useEffect(() => {
    if (!agent) return;
    setBreadcrumbs([
      { label: "Agents", href: "/agents" },
      { label: agent.name, href: `/agents/${canonicalAgentRef}` },
      { label: "Logs" },
    ]);
    return () => setBreadcrumbs([]);
  }, [agent, canonicalAgentRef, setBreadcrumbs]);

  const filteredRuns = useMemo(() => {
    if (!runs) return [];

    let filtered = [...runs];

    // Status filter
    if (statusFilter === "succeeded") {
      filtered = filtered.filter((r) => r.status === "succeeded");
    } else if (statusFilter === "failed") {
      filtered = filtered.filter((r) => r.status === "failed" || r.status === "timed_out");
    } else if (statusFilter === "running") {
      filtered = filtered.filter((r) => r.status === "running" || r.status === "queued");
    }

    // Date range filter
    if (dateRange !== "all") {
      const now = Date.now();
      const ms = dateRange === "24h" ? 86400_000 : dateRange === "7d" ? 604800_000 : 2592000_000;
      const cutoff = now - ms;
      filtered = filtered.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
    }

    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [runs, statusFilter, dateRange]);

  if (agentLoading || runsLoading) return <PageSkeleton />;
  if (!agent) return <div className="text-sm text-muted-foreground p-4">Agent not found.</div>;

  const statusCounts = {
    all: runs?.length ?? 0,
    succeeded: runs?.filter((r) => r.status === "succeeded").length ?? 0,
    failed: runs?.filter((r) => r.status === "failed" || r.status === "timed_out").length ?? 0,
    running: runs?.filter((r) => r.status === "running" || r.status === "queued").length ?? 0,
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Back link */}
      <Link
        to={`/agents/${canonicalAgentRef}`}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to {agent.name}
      </Link>

      <h1 className="text-lg font-semibold">Run History</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground mr-1">Status:</span>
          {(["all", "succeeded", "failed", "running"] as StatusFilter[]).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1 text-muted-foreground">({statusCounts[s]})</span>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">Period:</span>
          {(["24h", "7d", "30d", "all"] as DateRange[]).map((d) => (
            <Button
              key={d}
              variant={dateRange === d ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setDateRange(d)}
            >
              {d === "all" ? "All time" : d === "24h" ? "24h" : d === "7d" ? "7 days" : "30 days"}
            </Button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredRuns.length} run{filteredRuns.length !== 1 ? "s" : ""}
      </div>

      {/* Run list */}
      {filteredRuns.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No runs match the current filters.
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {filteredRuns.map((run) => {
            const statusInfo = runStatusIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
            const StatusIcon = statusInfo.icon;
            const duration = runDuration(run);
            const cost = runCost(run);
            const ctx = run.contextSnapshot as Record<string, unknown> | null;
            const title = issueTitle(ctx);
            const iid = issueId(ctx);
            const isExpanded = expandedRunId === run.id;

            return (
              <div key={run.id}>
                <button
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 text-left transition-colors hover:bg-accent/20",
                    isExpanded && "bg-accent/10",
                  )}
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-90")} />
                  <StatusIcon className={cn("h-4 w-4 shrink-0", statusInfo.color, run.status === "running" && "animate-spin")} />
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs text-muted-foreground">{run.id.slice(0, 8)}</span>
                    <StatusBadge status={run.status} />
                    <span className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                      run.invocationSource === "timer" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                        : run.invocationSource === "assignment" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                        : run.invocationSource === "on_demand" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {sourceLabels[run.invocationSource] ?? run.invocationSource}
                    </span>
                    {title && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    {duration !== null && (
                      <span className="font-mono">{formatDuration(duration)}</span>
                    )}
                    {cost > 0 && (
                      <span className="font-mono">${cost.toFixed(3)}</span>
                    )}
                    <span className="w-16 text-right">{relativeTime(run.createdAt)}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    {/* Quick links */}
                    <div className="flex items-center gap-3 mb-3 text-xs">
                      <Link
                        to={`/agents/${canonicalAgentRef}/runs/${run.id}`}
                        className="text-primary hover:underline"
                      >
                        Open full run detail
                      </Link>
                      {iid && (
                        <Link
                          to={`/issues/${iid}`}
                          className="text-primary hover:underline"
                        >
                          View issue
                        </Link>
                      )}
                    </div>

                    {/* Error summary */}
                    {run.error && (
                      <div className="mb-3 text-xs text-red-600 dark:text-red-400">
                        {run.error}
                        {run.errorCode && <span className="text-muted-foreground ml-1">({run.errorCode})</span>}
                      </div>
                    )}

                    {/* Inline log viewer */}
                    <RunLogViewer
                      run={run}
                      adapterType={agent.adapterType}
                      maxHeight={500}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
