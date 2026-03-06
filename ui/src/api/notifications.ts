import { api } from "./client";

export interface NotificationChannel {
  id: string;
  companyId: string;
  channelType: string;
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

export const notificationsApi = {
  listChannels: (companyId: string) =>
    api.get<NotificationChannel[]>(`/companies/${companyId}/notifications/channels`),
  createChannel: (companyId: string, data: Partial<NotificationChannel>) =>
    api.post<NotificationChannel>(`/companies/${companyId}/notifications/channels`, data),
  updateChannel: (companyId: string, id: string, data: Partial<NotificationChannel>) =>
    api.patch<NotificationChannel>(`/companies/${companyId}/notifications/channels/${id}`, data),
  deleteChannel: (companyId: string, id: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/notifications/channels/${id}`),
  testChannel: (companyId: string, id: string) =>
    api.post<{ ok: true }>(`/companies/${companyId}/notifications/channels/${id}/test`, {}),

  listRules: (companyId: string) =>
    api.get<NotificationRule[]>(`/companies/${companyId}/notifications/rules`),
  createRule: (companyId: string, data: Partial<NotificationRule>) =>
    api.post<NotificationRule>(`/companies/${companyId}/notifications/rules`, data),
  updateRule: (companyId: string, id: string, data: Partial<NotificationRule>) =>
    api.patch<NotificationRule>(`/companies/${companyId}/notifications/rules/${id}`, data),
  deleteRule: (companyId: string, id: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/notifications/rules/${id}`),
};
