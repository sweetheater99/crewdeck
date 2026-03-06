export interface AgentMessage {
  id: string;
  companyId: string;
  issueId: string | null;
  fromAgentId: string | null;
  toAgentId: string | null;
  content: string;
  messageType: "message" | "escalation" | "response";
  readAt: string | null;
  createdAt: string;
}
