import { apiClient } from '../lib/api';

export interface SessionSyncProgress {
  syncId: string;
  integrationId: number;
  integrationName: string;
  workspaceId: number;
  status: number;
  totalOnlineUsers: number;
  processedUsers: number;
  successfulSyncs: number;
  failedSyncs: number;
  progressPercentage: number;
  currentMessage?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  lastUpdatedAt: string;
}

export interface SessionSyncLog {
  id: number;
  syncId: string;
  integrationId: number;
  workspaceId: number;
  timestamp: string;
  status: number;
  totalSessions: number;
  newSessions: number;
  updatedSessions: number;
  failedSessions: number;
  durationSeconds: number;
  errorMessage?: string;
  createdAt: string;
}

export const sessionSyncApi = {
  startSync: async (workspaceId: number, integrationId: number): Promise<{ syncId: string; message: string }> => {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/session-sync/start/${integrationId}`);
    return response.data;
  },

  getProgress: async (workspaceId: number, syncId: string): Promise<SessionSyncProgress> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/session-sync/progress/${syncId}`);
    return response.data;
  },

  getLogs: async (workspaceId: number, integrationId: number): Promise<SessionSyncLog[]> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/session-sync/logs/${integrationId}`);
    return response.data;
  },

  cancelSync: async (workspaceId: number, syncId: string): Promise<void> => {
    await apiClient.post(`/api/workspaces/${workspaceId}/session-sync/cancel/${syncId}`);
  },
};
