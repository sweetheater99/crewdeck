import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Pencil, Trash2, Send, MessageSquare, Globe, Webhook } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { notificationsApi } from "../api/notifications";
import type { NotificationChannel, NotificationRule } from "../api/notifications";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, ToggleField } from "../components/agent-config-primitives";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const EVENT_TYPES = [
  { value: "task.completed", label: "Task Completed" },
  { value: "task.failed", label: "Task Failed" },
  { value: "task.unblocked", label: "Task Unblocked" },
  { value: "agent.failed", label: "Agent Failed" },
  { value: "agent.escalation", label: "Agent Escalation" },
  { value: "agent.budget_warning", label: "Budget Warning" },
  { value: "agent.budget_exceeded", label: "Budget Exceeded" },
  { value: "agent.review_pending", label: "Review Pending" },
  { value: "agent.circuit_breaker", label: "Circuit Breaker" },
];

const CHANNEL_TYPES = [
  { value: "telegram", label: "Telegram", icon: Send },
  { value: "discord", label: "Discord", icon: MessageSquare },
  { value: "webhook", label: "Webhook", icon: Globe },
];

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

function channelIcon(type: string) {
  const entry = CHANNEL_TYPES.find((ct) => ct.value === type);
  if (!entry) return <Webhook className="h-4 w-4" />;
  const Icon = entry.icon;
  return <Icon className="h-4 w-4" />;
}

/* ------------------------------------------------------------------ */
/*  Channel Form Dialog                                               */
/* ------------------------------------------------------------------ */

function ChannelDialog({
  open,
  onClose,
  companyId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  existing?: NotificationChannel | null;
}) {
  const queryClient = useQueryClient();
  const [channelType, setChannelType] = useState(existing?.channelType ?? "telegram");
  const [label, setLabel] = useState(existing?.label ?? "");
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [digestEnabled, setDigestEnabled] = useState(existing?.digestEnabled ?? false);
  const [digestTime, setDigestTime] = useState(existing?.digestTime ?? "09:00");
  const [digestTimezone, setDigestTimezone] = useState(existing?.digestTimezone ?? "UTC");

  // Config fields
  const existingConfig = (existing?.config ?? {}) as Record<string, string>;
  const [botToken, setBotToken] = useState(existingConfig.botToken ?? "");
  const [chatId, setChatId] = useState(existingConfig.chatId ?? "");
  const [webhookUrl, setWebhookUrl] = useState(existingConfig.webhookUrl ?? "");
  const [url, setUrl] = useState(existingConfig.url ?? "");
  const [secret, setSecret] = useState(existingConfig.secret ?? "");

  useEffect(() => {
    if (open) {
      setChannelType(existing?.channelType ?? "telegram");
      setLabel(existing?.label ?? "");
      setEnabled(existing?.enabled ?? true);
      setDigestEnabled(existing?.digestEnabled ?? false);
      setDigestTime(existing?.digestTime ?? "09:00");
      setDigestTimezone(existing?.digestTimezone ?? "UTC");
      const cfg = (existing?.config ?? {}) as Record<string, string>;
      setBotToken(cfg.botToken ?? "");
      setChatId(cfg.chatId ?? "");
      setWebhookUrl(cfg.webhookUrl ?? "");
      setUrl(cfg.url ?? "");
      setSecret(cfg.secret ?? "");
    }
  }, [open, existing]);

  function buildConfig(): Record<string, unknown> {
    switch (channelType) {
      case "telegram":
        return { botToken, chatId };
      case "discord":
        return { webhookUrl };
      case "webhook":
        return { url, ...(secret ? { secret } : {}) };
      default:
        return {};
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: Partial<NotificationChannel>) =>
      notificationsApi.createChannel(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.channels(companyId) });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<NotificationChannel>) =>
      notificationsApi.updateChannel(companyId, existing!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.channels(companyId) });
      onClose();
    },
  });

  const testMutation = useMutation({
    mutationFn: () => notificationsApi.testChannel(companyId, existing!.id),
  });

  function handleSubmit() {
    const data = {
      channelType,
      label: label.trim() || null,
      config: buildConfig(),
      enabled,
      digestEnabled,
      digestTime: digestEnabled ? digestTime : null,
      digestTimezone: digestEnabled ? digestTimezone : null,
    };
    if (existing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Channel" : "Add Channel"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Field label="Channel type">
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={channelType}
              onChange={(e) => setChannelType(e.target.value)}
              disabled={!!existing}
            >
              {CHANNEL_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Label" hint="A friendly name for this channel.">
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={label}
              placeholder="e.g. Team Alerts"
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>

          {/* Dynamic config fields */}
          {channelType === "telegram" && (
            <>
              <Field label="Bot Token">
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none font-mono"
                  type="password"
                  value={botToken}
                  placeholder="123456:ABC-DEF..."
                  onChange={(e) => setBotToken(e.target.value)}
                />
              </Field>
              <Field label="Chat ID">
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none font-mono"
                  type="text"
                  value={chatId}
                  placeholder="-1001234567890"
                  onChange={(e) => setChatId(e.target.value)}
                />
              </Field>
            </>
          )}

          {channelType === "discord" && (
            <Field label="Webhook URL">
              <input
                className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none font-mono"
                type="text"
                value={webhookUrl}
                placeholder="https://discord.com/api/webhooks/..."
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </Field>
          )}

          {channelType === "webhook" && (
            <>
              <Field label="URL">
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none font-mono"
                  type="text"
                  value={url}
                  placeholder="https://example.com/webhook"
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
              <Field label="Secret" hint="Optional. Used to sign payloads with HMAC-SHA256.">
                <input
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none font-mono"
                  type="password"
                  value={secret}
                  placeholder="Optional"
                  onChange={(e) => setSecret(e.target.value)}
                />
              </Field>
            </>
          )}

          <ToggleField
            label="Enabled"
            hint="Disable to pause notifications without removing the channel."
            checked={enabled}
            onChange={setEnabled}
          />

          <ToggleField
            label="Daily digest"
            hint="Receive a daily summary instead of individual notifications."
            checked={digestEnabled}
            onChange={setDigestEnabled}
          />

          {digestEnabled && (
            <div className="flex gap-3">
              <Field label="Time">
                <input
                  className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  type="time"
                  value={digestTime}
                  onChange={(e) => setDigestTime(e.target.value)}
                />
              </Field>
              <Field label="Timezone">
                <select
                  className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  value={digestTimezone}
                  onChange={(e) => setDigestTimezone(e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : existing ? "Update" : "Create"}
            </Button>
            {existing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? "Sending..." : "Send Test"}
              </Button>
            )}
            {testMutation.isSuccess && (
              <span className="text-xs text-muted-foreground">Test sent</span>
            )}
            {testMutation.isError && (
              <span className="text-xs text-destructive">
                {testMutation.error instanceof Error
                  ? testMutation.error.message
                  : "Test failed"}
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Rule Form Dialog                                                  */
/* ------------------------------------------------------------------ */

function RuleDialog({
  open,
  onClose,
  companyId,
  channels,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  channels: NotificationChannel[];
  existing?: NotificationRule | null;
}) {
  const queryClient = useQueryClient();
  const [eventType, setEventType] = useState(existing?.eventType ?? EVENT_TYPES[0]!.value);
  const [channelId, setChannelId] = useState(existing?.channelId ?? "");
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);

  useEffect(() => {
    if (open) {
      setEventType(existing?.eventType ?? EVENT_TYPES[0]!.value);
      setChannelId(existing?.channelId ?? channels[0]?.id ?? "");
      setEnabled(existing?.enabled ?? true);
    }
  }, [open, existing, channels]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<NotificationRule>) =>
      notificationsApi.createRule(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.rules(companyId) });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<NotificationRule>) =>
      notificationsApi.updateRule(companyId, existing!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.rules(companyId) });
      onClose();
    },
  });

  function handleSubmit() {
    const data = { eventType, channelId, enabled };
    if (existing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Rule" : "Add Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Field label="Event type">
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            >
              {EVENT_TYPES.map((et) => (
                <option key={et.value} value={et.value}>
                  {et.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Channel">
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            >
              {channels.length === 0 && (
                <option value="" disabled>
                  No channels configured
                </option>
              )}
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.label || ch.channelType} ({ch.channelType})
                </option>
              ))}
            </select>
          </Field>

          <ToggleField
            label="Enabled"
            hint="Disable to pause this rule without removing it."
            checked={enabled}
            onChange={setEnabled}
          />

          <div className="pt-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || !channelId}
            >
              {isPending ? "Saving..." : existing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export function NotificationSettings() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Project", href: "/dashboard" },
      { label: "Settings", href: "/company/settings" },
      { label: "Notifications" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const channelsQuery = useQuery({
    queryKey: queryKeys.notifications.channels(selectedCompanyId!),
    queryFn: () => notificationsApi.listChannels(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const rulesQuery = useQuery({
    queryKey: queryKeys.notifications.rules(selectedCompanyId!),
    queryFn: () => notificationsApi.listRules(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.deleteChannel(selectedCompanyId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.channels(selectedCompanyId!),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.rules(selectedCompanyId!),
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.deleteRule(selectedCompanyId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.rules(selectedCompanyId!),
      });
    },
  });

  if (!selectedCompany) {
    return (
      <div className="text-sm text-muted-foreground">
        No project selected. Select a project from the switcher above.
      </div>
    );
  }

  const channels = channelsQuery.data ?? [];
  const rules = rulesQuery.data ?? [];

  function channelLabelById(id: string) {
    const ch = channels.find((c) => c.id === id);
    return ch ? ch.label || ch.channelType : "Unknown";
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Notification Settings</h1>
      </div>

      {/* Channels Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Channels
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingChannel(null);
              setChannelDialogOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Channel
          </Button>
        </div>

        {channels.length === 0 ? (
          <div className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No notification channels configured. Add one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center gap-3 rounded-md border border-border px-4 py-3"
              >
                <span className="text-muted-foreground">{channelIcon(ch.channelType)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {ch.label || ch.channelType}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {ch.channelType}
                    {ch.digestEnabled && ` - Digest at ${ch.digestTime} ${ch.digestTimezone}`}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    ch.enabled
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {ch.enabled ? "Active" : "Disabled"}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingChannel(ch);
                    setChannelDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Delete channel "${ch.label || ch.channelType}"?`)) {
                      deleteChannelMutation.mutate(ch.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Rules
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingRule(null);
              setRuleDialogOpen(true);
            }}
            disabled={channels.length === 0}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {channels.length === 0
              ? "Add a channel first, then create rules to route events."
              : "No notification rules configured. Add one to start receiving alerts."}
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => {
              const eventLabel =
                EVENT_TYPES.find((et) => et.value === rule.eventType)?.label ??
                rule.eventType;
              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 rounded-md border border-border px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{eventLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      Channel: {channelLabelById(rule.channelId)}
                      {rule.filter && Object.keys(rule.filter).length > 0 && (
                        <span className="ml-2">
                          Filter: {JSON.stringify(rule.filter)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      rule.enabled
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {rule.enabled ? "Active" : "Disabled"}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingRule(rule);
                      setRuleDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm("Delete this rule?")) {
                        deleteRuleMutation.mutate(rule.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ChannelDialog
        open={channelDialogOpen}
        onClose={() => setChannelDialogOpen(false)}
        companyId={selectedCompanyId!}
        existing={editingChannel}
      />
      <RuleDialog
        open={ruleDialogOpen}
        onClose={() => setRuleDialogOpen(false)}
        companyId={selectedCompanyId!}
        channels={channels}
        existing={editingRule}
      />
    </div>
  );
}
