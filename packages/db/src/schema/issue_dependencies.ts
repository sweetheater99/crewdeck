import { pgTable, uuid, timestamp, unique, index } from "drizzle-orm/pg-core";
import { issues } from "./issues.js";
import { companies } from "./companies.js";

export const issueDependencies = pgTable(
  "issue_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uqDependency: unique("uq_issue_dependency").on(table.issueId, table.dependsOnId),
    issueIdx: index("issue_dependencies_issue_idx").on(table.issueId),
    dependsOnIdx: index("issue_dependencies_depends_on_idx").on(table.dependsOnId),
    companyIdx: index("issue_dependencies_company_idx").on(table.companyId),
  }),
);
