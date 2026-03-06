export interface KnowledgeEntry {
  id: string;
  companyId: string;
  projectId: string | null;
  title: string;
  content: string;
  tags: string[];
  createdByAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}
