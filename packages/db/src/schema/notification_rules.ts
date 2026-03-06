import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { notificationChannels } from "./notification_channels.js";

export const notificationRules = pgTable(
  "notification_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").notNull().references(() => notificationChannels.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    filter: jsonb("filter").$type<Record<string, unknown>>(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("notification_rules_company_idx").on(table.companyId),
    channelIdx: index("notification_rules_channel_idx").on(table.channelId),
  }),
);
