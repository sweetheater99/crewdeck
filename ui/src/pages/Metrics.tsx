import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { metricsApi } from "../api/metrics";
import type { AgentScorecard } from "../api/metrics";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCents } from "../lib/utils";
import {
  BarChart3,
  DollarSign,
  CheckCircle2,
  XCircle,
  Bot,
  ArrowUpDown,
} from "lucide-react";

type SortKey =
  | "name"
  | "tasksCompleted"
  | "successRate"
  | "avgDurationMinutes"
  | "costPerTaskCents"
  | "consecutiveFailures"
  | "status";

type SortDir = "asc" | "desc";

function rateColor(rate: number): string {
  if (rate >= 80) return "text-green-600 dark:text-green-400";
  if (rate >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function rateBg(rate: number): string {
  if (rate >= 80) return "bg-green-500";
  if (rate >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function Metrics() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [sortKey, setSortKey] = useState<SortKey>("tasksCompleted");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setBreadcrumbs([{ label: "Metrics" }]);
  }, [setBreadcrumbs]);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: queryKeys.metrics.overview(selectedCompanyId!),
    queryFn: () => metricsApi.overview(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agentScorecard } = useQuery({
    queryKey: queryKeys.metrics.agents(selectedCompanyId!),
    queryFn: () => metricsApi.agents(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: trends } = useQuery({
    queryKey: queryKeys.metrics.trends(selectedCompanyId!, period),
    queryFn: () => metricsApi.trends(selectedCompanyId!, period),
    enabled: !!selectedCompanyId,
  });

  const sortedAgents = useMemo(() => {
    if (!agentScorecard) return [];
    const sorted = [...agentScorecard];
    sorted.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
    return sorted;
  }, [agentScorecard, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={BarChart3}
        message="Select a project to view metrics."
      />
    );
  }

  if (overviewLoading) {
    return <PageSkeleton variant="costs" />;
  }

  const utilizationPercent =
    overview && overview.budgetCents > 0
      ? Math.round((overview.totalSpendCents / overview.budgetCents) * 100)
      : 0;

  const totalTasks =
    overview ? overview.tasksCompleted + overview.tasksFailed : 0;
  const successRatePercent =
    totalTasks > 0 && overview
      ? Math.round((overview.tasksCompleted / totalTasks) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
          <MetricCard
            icon={DollarSign}
            value={formatCents(overview.totalSpendCents)}
            label="Total Spend"
            description={
              <span>
                {overview.budgetCents > 0
                  ? `${utilizationPercent}% of ${formatCents(overview.budgetCents)} budget`
                  : "Unlimited budget"}
              </span>
            }
          />
          <MetricCard
            icon={CheckCircle2}
            value={overview.tasksCompleted}
            label="Tasks Completed"
            description={
              <span>{overview.tasksInProgress} in progress</span>
            }
          />
          <MetricCard
            icon={XCircle}
            value={overview.tasksFailed}
            label="Tasks Failed"
            description={
              <span>{successRatePercent}% success rate</span>
            }
          />
          <MetricCard
            icon={Bot}
            value={overview.activeAgents}
            label="Active Agents"
            description={
              <span>
                {overview.idleAgents} idle, {overview.pausedAgents} paused
              </span>
            }
          />
        </div>
      )}

      {/* Agent Leaderboard */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Agent Leaderboard</h3>
          {sortedAgents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No agent data available.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <SortHeader
                      label="Agent"
                      sortKey="name"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortHeader
                      label="Tasks"
                      sortKey="tasksCompleted"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                      className="text-right"
                    />
                    <SortHeader
                      label="Success Rate"
                      sortKey="successRate"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                      className="text-right"
                    />
                    <SortHeader
                      label="Avg Duration"
                      sortKey="avgDurationMinutes"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                      className="text-right"
                    />
                    <SortHeader
                      label="Cost/Task"
                      sortKey="costPerTaskCents"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                      className="text-right"
                    />
                    <SortHeader
                      label="Failures"
                      sortKey="consecutiveFailures"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                      className="text-right"
                    />
                    <SortHeader
                      label="Status"
                      sortKey="status"
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={toggleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent) => (
                    <AgentRow key={agent.agentId} agent={agent} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trend Charts */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Trends
        </span>
        <div className="flex gap-1 ml-auto">
          <Button
            variant={period === "7d" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPeriod("7d")}
          >
            7 Days
          </Button>
          <Button
            variant={period === "30d" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPeriod("30d")}
          >
            30 Days
          </Button>
        </div>
      </div>

      {trends && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SpendChart daily={trends.daily} />
          <ThroughputChart daily={trends.daily} />
        </div>
      )}
    </div>
  );
}

/* ---- Sort Header ---- */

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-3 py-2 font-medium text-xs cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/40"}`}
        />
        {active && (
          <span className="text-[10px]">
            {currentDir === "asc" ? "\u2191" : "\u2193"}
          </span>
        )}
      </span>
    </th>
  );
}

/* ---- Agent Row ---- */

function AgentRow({ agent }: { agent: AgentScorecard }) {
  const total = agent.tasksCompleted + agent.tasksFailed;
  return (
    <tr className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
      <td className="px-3 py-2.5 font-medium">{agent.name}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {agent.tasksCompleted}
        {agent.tasksFailed > 0 && (
          <span className="text-muted-foreground ml-1">
            / {total}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className={`font-medium tabular-nums ${rateColor(agent.successRate)}`}>
          {agent.successRate}%
        </span>
        <div className="mt-0.5 h-1 w-full max-w-[60px] bg-muted rounded-full overflow-hidden ml-auto">
          <div
            className={`h-full rounded-full ${rateBg(agent.successRate)}`}
            style={{ width: `${Math.min(100, agent.successRate)}%` }}
          />
        </div>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {agent.avgDurationMinutes.toFixed(1)}m
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {formatCents(agent.costPerTaskCents)}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {agent.consecutiveFailures > 0 ? (
          <span className="text-red-600 dark:text-red-400 font-medium">
            {agent.consecutiveFailures}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge status={agent.status} />
      </td>
    </tr>
  );
}

/* ---- CSS-based Spend Chart ---- */

function SpendChart({
  daily,
}: {
  daily: Array<{ date: string; spendCents: number }>;
}) {
  const maxSpend = Math.max(...daily.map((d) => d.spendCents), 1);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Spend Over Time</h3>
          <p className="text-xs text-muted-foreground">Daily spend</p>
        </div>
        <div className="flex items-end gap-[2px] h-32">
          {daily.map((d) => (
            <div
              key={d.date}
              className="flex-1 group relative"
              style={{ height: "100%" }}
            >
              <div className="absolute bottom-0 w-full flex flex-col items-center">
                <div
                  className="w-full rounded-t bg-blue-500/80 hover:bg-blue-500 transition-colors min-h-[2px]"
                  style={{
                    height: `${Math.max(2, (d.spendCents / maxSpend) * 100)}%`,
                  }}
                />
              </div>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border border-border rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap shadow-sm z-10">
                {formatDayLabel(d.date)}: {formatCents(d.spendCents)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
          <span>{daily.length > 0 ? formatDayLabel(daily[0].date) : ""}</span>
          <span>
            {daily.length > 0
              ? formatDayLabel(daily[daily.length - 1].date)
              : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---- CSS-based Throughput Chart ---- */

function ThroughputChart({
  daily,
}: {
  daily: Array<{
    date: string;
    tasksCompleted: number;
    tasksFailed: number;
  }>;
}) {
  const maxTasks = Math.max(
    ...daily.map((d) => d.tasksCompleted + d.tasksFailed),
    1,
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Task Throughput</h3>
          <p className="text-xs text-muted-foreground">
            Completed vs failed
          </p>
        </div>
        <div className="flex items-end gap-[2px] h-32">
          {daily.map((d) => {
            const total = d.tasksCompleted + d.tasksFailed;
            const pct = (total / maxTasks) * 100;
            const completedPct =
              total > 0 ? (d.tasksCompleted / total) * 100 : 0;
            return (
              <div
                key={d.date}
                className="flex-1 group relative"
                style={{ height: "100%" }}
              >
                <div className="absolute bottom-0 w-full flex flex-col">
                  <div
                    className="w-full rounded-t overflow-hidden flex flex-col-reverse min-h-[2px]"
                    style={{ height: `${Math.max(2, pct)}%` }}
                  >
                    <div
                      className="w-full bg-green-500/80"
                      style={{ height: `${completedPct}%` }}
                    />
                    <div
                      className="w-full bg-red-400/80"
                      style={{ height: `${100 - completedPct}%` }}
                    />
                  </div>
                </div>
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border border-border rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap shadow-sm z-10">
                  {formatDayLabel(d.date)}: {d.tasksCompleted} ok, {d.tasksFailed} fail
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between">
          <div className="flex gap-2.5">
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Completed
            </span>
            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Failed
            </span>
          </div>
          <div className="flex gap-4 text-[9px] text-muted-foreground tabular-nums">
            <span>{daily.length > 0 ? formatDayLabel(daily[0].date) : ""}</span>
            <span>
              {daily.length > 0
                ? formatDayLabel(daily[daily.length - 1].date)
                : ""}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
