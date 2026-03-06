import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { knowledgeApi } from "../api/knowledge";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn, relativeTime } from "../lib/utils";
import type { KnowledgeEntry } from "@crewdeck/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

function collectTags(entries: KnowledgeEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    for (const t of e.tags) set.add(t);
  }
  return Array.from(set).sort();
}

function truncate(text: string, max = 180): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function Knowledge() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  // Search & filter state
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Knowledge" }]);
  }, [setBreadcrumbs]);

  // Queries
  const tagsParam = selectedTags.length > 0 ? selectedTags.join(",") : undefined;
  const { data: entries, isLoading, error } = useQuery({
    queryKey: queryKeys.knowledge.list(selectedCompanyId!, debouncedSearch, tagsParam),
    queryFn: () =>
      knowledgeApi.search(selectedCompanyId!, {
        q: debouncedSearch || undefined,
        tags: tagsParam,
      }),
    enabled: !!selectedCompanyId,
  });

  // Fetch unfiltered entries just for tag extraction (only when filters are active)
  const { data: allEntries } = useQuery({
    queryKey: queryKeys.knowledge.list(selectedCompanyId!, "", undefined),
    queryFn: () => knowledgeApi.search(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const allTags = useMemo(() => collectTags(allEntries ?? entries ?? []), [allEntries, entries]);

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Mutations
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["knowledge", selectedCompanyId!] });
  }, [queryClient, selectedCompanyId]);

  const createMutation = useMutation({
    mutationFn: (data: { title: string; content: string; tags?: string[]; projectId?: string }) =>
      knowledgeApi.create(selectedCompanyId!, data),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string; tags?: string[] } }) =>
      knowledgeApi.update(selectedCompanyId!, id, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => knowledgeApi.remove(selectedCompanyId!, id),
    onSuccess: invalidate,
  });

  // Handlers
  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(entry: KnowledgeEntry) {
    setEditing(entry);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  // Project name helper
  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects ?? []) m.set(p.id, p.name);
    return m;
  }, [projects]);

  // Loading / empty guards
  if (!selectedCompanyId) {
    return <EmptyState icon={BookOpen} message="Select a project to view knowledge entries." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      {/* Top bar: search + new */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search knowledge..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Entry
        </Button>
      </div>

      {/* Tag chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                "inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border transition-colors",
                selectedTags.includes(tag)
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:bg-accent/50",
              )}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {/* Empty state */}
      {entries && entries.length === 0 && !debouncedSearch && selectedTags.length === 0 && (
        <EmptyState
          icon={BookOpen}
          message="No knowledge entries yet. Create one to help your agents share context."
          action="New Entry"
          onAction={openCreate}
        />
      )}

      {entries && entries.length === 0 && (debouncedSearch || selectedTags.length > 0) && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No entries match the current filters.
        </p>
      )}

      {/* Entry list */}
      {entries && entries.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </p>
          <div className="border border-border divide-y divide-border">
            {entries.map((entry) => {
              const expanded = expandedId === entry.id;
              return (
                <div key={entry.id} className="group">
                  <button
                    className="flex items-start gap-3 w-full px-3 py-3 text-left hover:bg-accent/30 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : entry.id)}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{entry.title}</span>
                        {entry.projectId && projectMap.has(entry.projectId) && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {projectMap.get(entry.projectId)}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {expanded ? entry.content : truncate(entry.content)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                          {entry.createdByAgentId ? "Agent" : "Owner"} &middot; {relativeTime(entry.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 space-y-3">
                      <div className="bg-muted/30 p-3 text-sm whitespace-pre-wrap">{entry.content}</div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(entry)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Create / Edit dialog */}
      <KnowledgeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        projects={projects ?? []}
        saving={createMutation.isPending || updateMutation.isPending}
        onSave={(data) => {
          if (editing) {
            updateMutation.mutate(
              { id: editing.id, data: { title: data.title, content: data.content, tags: data.tags } },
              { onSuccess: () => setFormOpen(false) },
            );
          } else {
            createMutation.mutate(data, { onSuccess: () => setFormOpen(false) });
          }
        }}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form dialog (create / edit)
// ---------------------------------------------------------------------------

interface KnowledgeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: KnowledgeEntry | null;
  projects: { id: string; name: string }[];
  saving: boolean;
  onSave: (data: { title: string; content: string; tags?: string[]; projectId?: string }) => void;
}

function KnowledgeFormDialog({ open, onOpenChange, editing, projects, saving, onSave }: KnowledgeFormDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [projectId, setProjectId] = useState<string>("__all__");
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? "");
      setContent(editing?.content ?? "");
      setTagsInput(editing?.tags.join(", ") ?? "");
      setProjectId(editing?.projectId ?? "__all__");
      // Focus title field after dialog renders
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [open, editing]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      title: title.trim(),
      content,
      tags: tags.length > 0 ? tags : undefined,
      projectId: projectId === "__all__" ? undefined : projectId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Entry" : "New Knowledge Entry"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update this knowledge entry." : "Create a new entry to share context with your agents."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ke-title">Title</Label>
            <Input
              ref={titleRef}
              id="ke-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deployment process"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ke-content">Content</Label>
            <Textarea
              id="ke-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the knowledge content..."
              className="min-h-32"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ke-tags">Tags (comma-separated)</Label>
            <Input
              id="ke-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. deploy, infra, ci-cd"
            />
          </div>
          {!editing && (
            <div className="space-y-1.5">
              <Label>Project scope</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !title.trim() || !content.trim()}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
