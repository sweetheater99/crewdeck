import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    channelType: text("channel_type").notNull(),
    label: text("label"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    digestEnabled: boolean("digest_enabled").notNull().default(false),
    digestTime: text("digest_time"),
    digestTimezone: text("digest_timezone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("notification_channels_company_idx").on(table.companyId),
  }),
);
