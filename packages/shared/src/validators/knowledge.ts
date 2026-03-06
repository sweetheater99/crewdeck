import { z } from "zod";

export const createKnowledgeEntrySchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  createdByAgentId: z.string().uuid().optional().nullable(),
});

export type CreateKnowledgeEntry = z.infer<typeof createKnowledgeEntrySchema>;

export const updateKnowledgeEntrySchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export type UpdateKnowledgeEntry = z.infer<typeof updateKnowledgeEntrySchema>;
