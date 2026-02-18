import { apiClient } from '../lib/api';

const API_BASE = '/api/workflowhistory';

export interface WorkflowHistory {
  id: number;
  uuid: string;
  automationId: number;
  workflowJson: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  createdBy?: string;
}

export interface CreateWorkflowHistoryRequest {
  automationId: number;
  workflowJson: string;
  nodeCount: number;
  edgeCount: number;
}

export const workflowHistoryApi = {
  // Get history for an automation
  getHistoryByAutomation: async (automationId: number, limit: number = 50): Promise<WorkflowHistory[]> => {
    const response = await apiClient.get(`${API_BASE}/automation/${automationId}`, {
      params: { limit }
    });
    return response.data;
  },

  // Create a new history entry
  createHistory: async (request: CreateWorkflowHistoryRequest): Promise<WorkflowHistory> => {
    const response = await apiClient.post(API_BASE, request);
    return response.data;
  },

  // Delete a history entry
  deleteHistory: async (id: number): Promise<void> => {
    await apiClient.delete(`${API_BASE}/${id}`);
  },

  // Cleanup old history (keep last N entries)
  cleanupOldHistory: async (automationId: number, keepLast: number = 50): Promise<{ deleted: number }> => {
    const response = await apiClient.delete(`${API_BASE}/automation/${automationId}/cleanup`, {
      params: { keepLast }
    });
    return response.data;
  }
};
