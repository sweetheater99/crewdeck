export interface NotificationChannel {
  id: string;
  companyId: string;
  channelType: "telegram" | "discord" | "webhook";
  label: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  digestEnabled: boolean;
  digestTime: string | null;
  digestTimezone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRule {
  id: string;
  companyId: string;
  channelId: string;
  eventType: string;
  filter: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: string;
}

export type NotificationEventType =
  | "task.completed"
  | "task.failed"
  | "task.unblocked"
  | "agent.failed"
  | "agent.escalation"
  | "agent.budget_warning"
  | "agent.budget_exceeded"
  | "agent.review_pending"
  | "agent.circuit_breaker"
  | "digest.daily";
