import type { KnowledgeEntry } from "@crewdeck/shared";
import { api } from "./client";

export const knowledgeApi = {
  search: (companyId: string, params?: { projectId?: string; q?: string; tags?: string }) => {
    const sp = new URLSearchParams();
    if (params?.projectId) sp.set("projectId", params.projectId);
    if (params?.q) sp.set("q", params.q);
    if (params?.tags) sp.set("tags", params.tags);
    const qs = sp.toString();
    return api.get<KnowledgeEntry[]>(`/companies/${companyId}/knowledge${qs ? `?${qs}` : ""}`);
  },

  get: (companyId: string, id: string) =>
    api.get<KnowledgeEntry>(`/companies/${companyId}/knowledge/${id}`),

  create: (companyId: string, data: { title: string; content: string; tags?: string[]; projectId?: string }) =>
    api.post<KnowledgeEntry>(`/companies/${companyId}/knowledge`, data),

  update: (companyId: string, id: string, data: { title?: string; content?: string; tags?: string[] }) =>
    api.patch<KnowledgeEntry>(`/companies/${companyId}/knowledge/${id}`, data),

  remove: (companyId: string, id: string) =>
    api.delete<KnowledgeEntry>(`/companies/${companyId}/knowledge/${id}`),
};
