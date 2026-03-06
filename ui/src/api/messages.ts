import type { AgentMessage } from "@crewdeck/shared";
import { api } from "./client";

export const messagesApi = {
  list: (companyId: string, params?: { agentId?: string; issueId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.agentId) searchParams.set("agentId", params.agentId);
    if (params?.issueId) searchParams.set("issueId", params.issueId);
    const qs = searchParams.toString();
    return api.get<AgentMessage[]>(`/companies/${companyId}/messages${qs ? `?${qs}` : ""}`);
  },

  send: (
    companyId: string,
    data: {
      fromAgentId?: string | null;
      toAgentId?: string | null;
      issueId?: string | null;
      content: string;
      messageType?: string;
    },
  ) => api.post<AgentMessage>(`/companies/${companyId}/messages`, data),

  markRead: (companyId: string, messageId: string) =>
    api.patch<AgentMessage>(`/companies/${companyId}/messages/${messageId}/read`, {}),
};
