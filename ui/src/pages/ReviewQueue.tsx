import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime } from "../lib/utils";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { Identity } from "../components/Identity";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Check, X } from "lucide-react";
import type { Issue, Agent } from "@crewdeck/shared";

export function ReviewQueue() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Review Queue" }]);
  }, [setBreadcrumbs]);

  const { data: allIssues, isLoading, error } = useQuery({
    queryKey: queryKeys.reviewQueue(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = new Map<string, Agent>();
  for (const a of agents ?? []) agentMap.set(a.id, a);

  const pendingIssues = (allIssues ?? [])
    .filter((i: Issue) => i.reviewStatus === "pending_review")
    .sort((a: Issue, b: Issue) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const approveMutation = useMutation({
    mutationFn: (issueId: string) =>
      issuesApi.reviewIssue(selectedCompanyId!, issueId, "approve"),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ issueId, feedback: fb }: { issueId: string; feedback?: string }) =>
      issuesApi.reviewIssue(selectedCompanyId!, issueId, "reject", fb),
    onSuccess: () => {
      setActionError(null);
      setRejectingId(null);
      setFeedback("");
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sidebarBadges(selectedCompanyId!) });
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    },
  });

  if (!selectedCompanyId) {
    return <p className="text-sm text-muted-foreground">Select a project first.</p>;
  }

  if (isLoading) {
    return <PageSkeleton variant="approvals" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Review Queue</h1>
        {pendingIssues.length > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              "bg-yellow-500/20 text-yellow-500",
            )}
          >
            {pendingIssues.length}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {pendingIssues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardCheck className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No tasks pending review</p>
        </div>
      )}

      {pendingIssues.length > 0 && (
        <div className="grid gap-3">
          {pendingIssues.map((issue: Issue) => {
            const agent = issue.assigneeAgentId
              ? agentMap.get(issue.assigneeAgentId)
              : null;
            const isRejecting = rejectingId === issue.id;

            return (
              <div
                key={issue.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <StatusIcon status={issue.status} />
                  <PriorityIcon priority={issue.priority} />
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {issue.identifier ?? issue.id.slice(0, 8)}
                  </span>
                  <Link
                    to={`/issues/${issue.identifier ?? issue.id}`}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {issue.title}
                  </Link>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {relativeTime(issue.updatedAt)}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {agent && (
                    <span className="flex items-center gap-1">
                      <Identity name={agent.name} size="sm" />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => approveMutation.mutate(issue.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Approve
                  </Button>
                  {isRejecting ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                        placeholder="Rejection feedback..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            rejectMutation.mutate({ issueId: issue.id, feedback: feedback || undefined });
                          }
                          if (e.key === "Escape") {
                            setRejectingId(null);
                            setFeedback("");
                          }
                        }}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          rejectMutation.mutate({ issueId: issue.id, feedback: feedback || undefined })
                        }
                        disabled={rejectMutation.isPending}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRejectingId(null);
                          setFeedback("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRejectingId(issue.id);
                        setFeedback("");
                      }}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
