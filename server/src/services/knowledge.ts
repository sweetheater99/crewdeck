import { and, eq, desc, sql, isNull } from "drizzle-orm";
import type { Db } from "@crewdeck/db";
import { knowledgeEntries } from "@crewdeck/db";
import { notFound } from "../errors.js";

const CONTENT_PREVIEW_LENGTH = 200;

function truncateContent(content: string): string {
  if (content.length <= CONTENT_PREVIEW_LENGTH) return content;
  return content.slice(0, CONTENT_PREVIEW_LENGTH) + "...";
}

export function knowledgeService(db: Db) {
  return {
    create: async (
      companyId: string,
      data: {
        projectId?: string | null;
        title: string;
        content: string;
        tags?: string[];
        createdByAgentId?: string | null;
      },
    ) =>
      db
        .insert(knowledgeEntries)
        .values({
          companyId,
          projectId: data.projectId ?? null,
          title: data.title,
          content: data.content,
          tags: data.tags ?? [],
          createdByAgentId: data.createdByAgentId ?? null,
        })
        .returning()
        .then((rows) => rows[0]),

    update: async (companyId: string, id: string, data: { title?: string; content?: string; tags?: string[] }) => {
      const existing = await db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.companyId, companyId)))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Knowledge entry not found");

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.title !== undefined) updates.title = data.title;
      if (data.content !== undefined) updates.content = data.content;
      if (data.tags !== undefined) updates.tags = data.tags;

      return db
        .update(knowledgeEntries)
        .set(updates)
        .where(eq(knowledgeEntries.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    remove: async (companyId: string, id: string) => {
      const existing = await db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.companyId, companyId)))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Knowledge entry not found");

      return db
        .delete(knowledgeEntries)
        .where(eq(knowledgeEntries.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    search: async (
      companyId: string,
      opts: { projectId?: string; query?: string; tags?: string[] } = {},
    ) => {
      const conditions = [eq(knowledgeEntries.companyId, companyId)];

      if (opts.projectId) {
        // Include entries scoped to this project OR company-wide (projectId IS NULL)
        conditions.push(
          sql`(${knowledgeEntries.projectId} = ${opts.projectId} OR ${knowledgeEntries.projectId} IS NULL)`,
        );
      }

      if (opts.tags && opts.tags.length > 0) {
        conditions.push(sql`${knowledgeEntries.tags} && ARRAY[${sql.join(opts.tags.map((t) => sql`${t}`), sql`, `)}]::text[]`);
      }

      if (opts.query) {
        const tsQuery = opts.query;
        conditions.push(
          sql`to_tsvector('english', ${knowledgeEntries.title} || ' ' || ${knowledgeEntries.content}) @@ plainto_tsquery('english', ${tsQuery})`,
        );

        const rows = await db
          .select()
          .from(knowledgeEntries)
          .where(and(...conditions))
          .orderBy(
            sql`ts_rank(to_tsvector('english', ${knowledgeEntries.title} || ' ' || ${knowledgeEntries.content}), plainto_tsquery('english', ${tsQuery})) DESC`,
          );

        return rows.map((row) => ({ ...row, content: truncateContent(row.content) }));
      }

      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(and(...conditions))
        .orderBy(desc(knowledgeEntries.updatedAt));

      return rows.map((row) => ({ ...row, content: truncateContent(row.content) }));
    },

    getById: async (companyId: string, id: string) =>
      db
        .select()
        .from(knowledgeEntries)
        .where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.companyId, companyId)))
        .then((rows) => rows[0] ?? null),

    getForContext: async (companyId: string, projectId?: string | null, tags?: string[]) => {
      const conditions = [eq(knowledgeEntries.companyId, companyId)];

      if (projectId) {
        conditions.push(
          sql`(${knowledgeEntries.projectId} = ${projectId} OR ${knowledgeEntries.projectId} IS NULL)`,
        );
      }

      if (tags && tags.length > 0) {
        conditions.push(sql`${knowledgeEntries.tags} && ARRAY[${sql.join(tags.map((t) => sql`${t}`), sql`, `)}]::text[]`);
      }

      return db
        .select()
        .from(knowledgeEntries)
        .where(and(...conditions))
        .orderBy(desc(knowledgeEntries.updatedAt))
        .limit(10);
    },
  };
}
