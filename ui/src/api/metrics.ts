import { api } from "./client";

export interface MetricsOverview {
  totalSpendCents: number;
  budgetCents: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksInProgress: number;
  activeAgents: number;
  idleAgents: number;
  pausedAgents: number;
}

export interface AgentScorecard {
  agentId: string;
  name: string;
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  avgDurationMinutes: number;
  totalCostCents: number;
  costPerTaskCents: number;
  consecutiveFailures: number;
  status: string;
}

export interface TrendDay {
  date: string;
  spendCents: number;
  tasksCompleted: number;
  tasksFailed: number;
  runsTotal: number;
}

export interface TrendsResponse {
  daily: TrendDay[];
}

export const metricsApi = {
  overview: (companyId: string) =>
    api.get<MetricsOverview>(`/companies/${companyId}/metrics/overview`),

  agents: (companyId: string) =>
    api.get<AgentScorecard[]>(`/companies/${companyId}/metrics/agents`),

  trends: (companyId: string, period: "7d" | "30d" = "7d") =>
    api.get<TrendsResponse>(`/companies/${companyId}/metrics/trends?period=${period}`),
};
