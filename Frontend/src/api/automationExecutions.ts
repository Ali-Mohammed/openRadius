import { apiClient } from '../lib/api';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface AutomationExecutionSummary {
  uuid: string;
  automationUuid: string;
  automationTitle?: string;
  triggerType: string;
  radiusUserUuid?: string;
  radiusUsername?: string;
  status: string;
  resultSummary?: string;
  actionsExecuted: number;
  actionsSucceeded: number;
  actionsFailed: number;
  executionTimeMs: number;
  triggeredBy?: string;
  correlationId: string;
  createdAt: string;
  completedAt?: string;
}

export interface AutomationExecutionStep {
  uuid: string;
  stepOrder: number;
  nodeId: string;
  nodeType: string;
  nodeSubType?: string;
  nodeLabel?: string;
  status: string;
  result?: string;
  errorMessage?: string;
  inputData?: string;
  outputData?: string;
  executionTimeMs: number;
  httpMethod?: string;
  httpUrl?: string;
  httpRequestHeaders?: string;
  httpRequestBody?: string;
  httpResponseStatusCode?: number;
  httpResponseHeaders?: string;
  httpResponseBody?: string;
  httpResponseTimeMs?: number;
  createdAt: string;
  completedAt?: string;
}

export interface AutomationExecutionDetail {
  uuid: string;
  automationUuid: string;
  automationTitle?: string;
  triggerType: string;
  triggerNodeId?: string;
  radiusUserUuid?: string;
  radiusUsername?: string;
  status: string;
  resultSummary?: string;
  errorMessage?: string;
  totalNodes: number;
  totalEdges: number;
  nodesVisited: number;
  actionsExecuted: number;
  actionsSucceeded: number;
  actionsFailed: number;
  conditionsEvaluated: number;
  executionTimeMs: number;
  triggeredBy?: string;
  sourceIpAddress?: string;
  correlationId: string;
  environment?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  steps?: AutomationExecutionStep[];
}

export interface ExecutionStats {
  totalExecutions: number;
  completed: number;
  completedWithErrors: number;
  failed: number;
  running: number;
  avgExecutionTimeMs: number;
  lastExecutedAt?: string;
}

export interface ExecutionListResponse {
  items: AutomationExecutionSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats?: ExecutionStats;
}

export interface ExecutionQueryParams {
  automationUuid?: string;
  triggerType?: string;
  status?: string;
  radiusUserUuid?: string;
  radiusUsername?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: string;
}

// ── API Functions ───────────────────────────────────────────────────────────

export const getExecutions = async (
  params?: ExecutionQueryParams
): Promise<ExecutionListResponse> => {
  const response = await apiClient.get('/api/automation-executions', { params });
  return response.data;
};

export const getExecutionByUuid = async (
  uuid: string
): Promise<AutomationExecutionDetail> => {
  const response = await apiClient.get(`/api/automation-executions/${uuid}`);
  return response.data;
};

export const getExecutionsByAutomation = async (
  automationUuid: string,
  params?: { page?: number; pageSize?: number; status?: string }
): Promise<ExecutionListResponse> => {
  const response = await apiClient.get(
    `/api/automation-executions/by-automation/${automationUuid}`,
    { params }
  );
  return response.data;
};

export const getExecutionSteps = async (
  uuid: string
): Promise<AutomationExecutionStep[]> => {
  const response = await apiClient.get(`/api/automation-executions/${uuid}/steps`);
  return response.data;
};

export const deleteExecution = async (uuid: string): Promise<void> => {
  await apiClient.delete(`/api/automation-executions/${uuid}`);
};

export const bulkDeleteExecutions = async (params: {
  automationUuid?: string;
  olderThan?: string;
  status?: string;
}): Promise<{ deletedCount: number }> => {
  const response = await apiClient.delete('/api/automation-executions/bulk', { params });
  return response.data;
};
