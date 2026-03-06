import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { agents } from "./agents.js";

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").references(() => issues.id),
    fromAgentId: uuid("from_agent_id").references(() => agents.id),
    toAgentId: uuid("to_agent_id").references(() => agents.id),
    content: text("content").notNull(),
    messageType: text("message_type").notNull().default("message"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("agent_messages_company_idx").on(table.companyId),
    issueIdx: index("agent_messages_issue_idx").on(table.issueId),
    fromAgentIdx: index("agent_messages_from_agent_idx").on(table.fromAgentId),
    toAgentIdx: index("agent_messages_to_agent_idx").on(table.toAgentId),
  }),
);
