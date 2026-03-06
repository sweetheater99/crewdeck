import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { StatusIcon } from "./StatusIcon";
import { StatusBadge } from "./StatusBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

interface DependencyPickerProps {
  issueId: string;
  companyId: string;
}

export function DependencyPicker({ issueId, companyId }: DependencyPickerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: dependencies } = useQuery({
    queryKey: queryKeys.issues.dependencies(issueId),
    queryFn: () => issuesApi.getDependencies(companyId, issueId),
    enabled: !!issueId && !!companyId,
  });

  const { data: dependents } = useQuery({
    queryKey: queryKeys.issues.dependents(issueId),
    queryFn: () => issuesApi.getDependents(companyId, issueId),
    enabled: !!issueId && !!companyId,
  });

  const { data: allIssues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: !!companyId,
  });

  const invalidateDeps = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.dependencies(issueId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.dependents(issueId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(issueId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) });
  };

  const addDep = useMutation({
    mutationFn: (dependsOnId: string) => issuesApi.addDependency(companyId, issueId, dependsOnId),
    onSuccess: () => {
      invalidateDeps();
      setOpen(false);
      setSearch("");
    },
  });

  const removeDep = useMutation({
    mutationFn: (dependsOnId: string) => issuesApi.removeDependency(companyId, issueId, dependsOnId),
    onSuccess: (_data, dependsOnId) => {
      invalidateDeps();
      // Also invalidate the dependent issue's dependents cache
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.dependents(dependsOnId) });
    },
  });

  const depIds = new Set((dependencies ?? []).map((d) => d.dependsOnId));
  const filteredIssues = (allIssues ?? []).filter((i) => {
    if (i.id === issueId) return false;
    if (depIds.has(i.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      (i.identifier && i.identifier.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-3">
      {/* Blocked by — editable */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">Blocked by</span>
          <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon-xs" title="Add dependency">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-1" align="end">
              <input
                className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                placeholder="Search issues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto overscroll-contain space-y-0.5">
                {filteredIssues.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">No issues found</p>
                ) : (
                  filteredIssues.slice(0, 20).map((i) => (
                    <button
                      key={i.id}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 text-left"
                      onClick={() => addDep.mutate(i.id)}
                      disabled={addDep.isPending}
                    >
                      <StatusIcon status={i.status} />
                      <span className="font-mono text-muted-foreground shrink-0">
                        {i.identifier ?? i.id.slice(0, 8)}
                      </span>
                      <span className="truncate">{i.title}</span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {(!dependencies || dependencies.length === 0) ? (
          <p className="text-xs text-muted-foreground">No dependencies</p>
        ) : (
          <div className="space-y-1">
            {dependencies.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs group"
              >
                <StatusIcon status={dep.status} />
                <Link
                  to={`/issues/${dep.identifier ?? dep.dependsOnId}`}
                  className="font-mono text-muted-foreground shrink-0 hover:underline"
                >
                  {dep.identifier ?? dep.dependsOnId.slice(0, 8)}
                </Link>
                <span className="truncate min-w-0">{dep.title}</span>
                <StatusBadge status={dep.status} />
                <button
                  className="ml-auto shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeDep.mutate(dep.dependsOnId)}
                  disabled={removeDep.isPending}
                  title="Remove dependency"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocks — read-only */}
      {dependents && dependents.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">Blocks</span>
          <div className="space-y-1">
            {dependents.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
              >
                <StatusIcon status={dep.status} />
                <Link
                  to={`/issues/${dep.identifier ?? dep.issueId}`}
                  className="font-mono text-muted-foreground shrink-0 hover:underline"
                >
                  {dep.identifier ?? dep.issueId.slice(0, 8)}
                </Link>
                <span className="truncate min-w-0">{dep.title}</span>
                <StatusBadge status={dep.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
