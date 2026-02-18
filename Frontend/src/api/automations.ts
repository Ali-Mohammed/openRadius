import { apiClient } from '../lib/api';

export interface Automation {
  id: number;
  uuid: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  status: string; // draft, active, paused, inactive
  isActive: boolean;
  workflowJson?: string;
  triggerType: string; // on_requested, on_action, scheduled
  scheduleType?: string | null; // at_time, periodic
  cronExpression?: string | null;
  scheduleIntervalMinutes?: number | null;
  scheduledTime?: string | null;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CreateAutomationRequest {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: string;
  isActive?: boolean;
  triggerType?: string;
  scheduleType?: string | null;
  cronExpression?: string | null;
  scheduleIntervalMinutes?: number | null;
  scheduledTime?: string | null;
}

export interface UpdateAutomationRequest {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: string;
  workflowJson?: string;
  isActive?: boolean;
  triggerType?: string;
  scheduleType?: string | null;
  cronExpression?: string | null;
  scheduleIntervalMinutes?: number | null;
  scheduledTime?: string | null;
}

export interface AutomationsResponse {
  data: Automation[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getAutomations = async (params?: {
  search?: string;
  status?: string;
  triggerType?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}): Promise<AutomationsResponse> => {
  const response = await apiClient.get('/api/automation', { params });
  return response.data;
};

export const getAutomationById = async (id: number): Promise<Automation> => {
  const response = await apiClient.get(`/api/automation/${id}`);
  return response.data;
};

export const createAutomation = async (data: CreateAutomationRequest): Promise<Automation> => {
  const response = await apiClient.post('/api/automation', data);
  return response.data;
};

export const updateAutomation = async (id: number, data: UpdateAutomationRequest): Promise<Automation> => {
  const response = await apiClient.put(`/api/automation/${id}`, data);
  return response.data;
};

export const deleteAutomation = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/automation/${id}`);
};

export const restoreAutomation = async (id: number): Promise<Automation> => {
  const response = await apiClient.post(`/api/automation/${id}/restore`);
  return response.data;
};

// Test automation execution types
export interface TestAutomationRequest {
  triggerType?: string;
  username?: string;
  email?: string;
  context?: Record<string, unknown>;
}

export interface TestStepResult {
  stepOrder: number;
  nodeId: string;
  nodeType: string;
  nodeSubType?: string;
  nodeLabel?: string;
  status: string;
  result?: string;
  errorMessage?: string;
  executionTimeMs: number;
  httpMethod?: string;
  httpUrl?: string;
  httpResponseStatusCode?: number;
}

export interface TestAutomationResult {
  success: boolean;
  executionUuid: string;
  status: string;
  resultSummary?: string;
  executionTimeMs: number;
  nodesVisited: number;
  actionsExecuted: number;
  actionsSucceeded: number;
  actionsFailed: number;
  errorMessage?: string;
  steps: TestStepResult[];
}

export const testAutomation = async (id: number, data: TestAutomationRequest): Promise<TestAutomationResult> => {
  const response = await apiClient.post(`/api/automation/${id}/test`, data);
  return response.data;
};
