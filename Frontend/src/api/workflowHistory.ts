import axios from 'axios';
import { appConfig } from '@/config/app.config';

const API_URL = appConfig.api.baseUrl;

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
    const response = await axios.get(`${API_URL}/api/workflowhistory/automation/${automationId}`, {
      params: { limit }
    });
    return response.data;
  },

  // Create a new history entry
  createHistory: async (request: CreateWorkflowHistoryRequest): Promise<WorkflowHistory> => {
    const response = await axios.post(`${API_URL}/api/workflowhistory`, request);
    return response.data;
  },

  // Delete a history entry
  deleteHistory: async (id: number): Promise<void> => {
    await axios.delete(`${API_URL}/api/workflowhistory/${id}`);
  },

  // Cleanup old history (keep last N entries)
  cleanupOldHistory: async (automationId: number, keepLast: number = 50): Promise<{ deleted: number }> => {
    const response = await axios.delete(`${API_URL}/api/workflowhistory/automation/${automationId}/cleanup`, {
      params: { keepLast }
    });
    return response.data;
  }
};
