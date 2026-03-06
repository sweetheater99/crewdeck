import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { messagesApi } from "../api/messages";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { relativeTime, cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Send, AlertTriangle } from "lucide-react";
import type { AgentMessage, Agent } from "@crewdeck/shared";

interface MessageThreadProps {
  companyId: string;
  issueId?: string;
  agentId?: string;
}

export function MessageThread({ companyId, issueId, agentId }: MessageThreadProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const queryKey = issueId
    ? queryKeys.messages.forIssue(companyId, issueId)
    : queryKeys.messages.forAgent(companyId, agentId!);

  const { data: messages, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      messagesApi.list(companyId, {
        issueId: issueId ?? undefined,
        agentId: agentId ?? undefined,
      }),
    enabled: !!companyId && !!(issueId || agentId),
    refetchInterval: 10_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const agentMap = new Map<string, Agent>();
  for (const a of agents ?? []) agentMap.set(a.id, a);

  const sendMessage = useMutation({
    mutationFn: (content: string) =>
      messagesApi.send(companyId, {
        fromAgentId: null,
        toAgentId: agentId ?? null,
        issueId: issueId ?? null,
        content,
        messageType: "message",
      }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const sorted = [...(messages ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sorted.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || sendMessage.isPending) return;
    sendMessage.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOwnerMessage = (msg: AgentMessage) => msg.fromAgentId === null;

  const senderName = (msg: AgentMessage) => {
    if (!msg.fromAgentId) return "You";
    return agentMap.get(msg.fromAgentId)?.name ?? msg.fromAgentId.slice(0, 8);
  };

  if (isLoading) {
    return <p className="text-xs text-muted-foreground py-4">Loading messages...</p>;
  }

  return (
    <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-background">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-96 min-h-[12rem] p-3 space-y-3">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No messages yet. Start the conversation below.
          </p>
        ) : (
          sorted.map((msg) => {
            const owner = isOwnerMessage(msg);
            const isEscalation = msg.messageType === "escalation";
            return (
              <div
                key={msg.id}
                className={cn("flex flex-col max-w-[85%] gap-0.5", owner ? "ml-auto items-end" : "items-start")}
              >
                <span className="text-[10px] text-muted-foreground px-1">
                  {senderName(msg)} · {relativeTime(msg.createdAt)}
                </span>
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                    isEscalation
                      ? "bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200"
                      : owner
                        ? "bg-primary text-primary-foreground"
                        : "bg-accent text-accent-foreground",
                  )}
                >
                  {isEscalation && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 mb-1">
                      <AlertTriangle className="h-3 w-3" />
                      Escalation
                    </span>
                  )}
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-2 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[2.25rem] max-h-32"
        />
        <Button
          size="icon"
          variant="default"
          onClick={handleSend}
          disabled={!draft.trim() || sendMessage.isPending}
          className="shrink-0 h-9 w-9"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
