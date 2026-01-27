import api from './client';
import type { 
  SasActivationLog, 
  ActivationLogResponse, 
  RetryResponse,
  TestActivationRequest 
} from '../types/sasActivation';

export const sasActivationsApi = {
  // Test activation
  testActivation: async (integrationId: number, request: TestActivationRequest) => {
    const response = await api.post<{ jobId: string; message: string }>(
      `/api/SasActivations/test/${integrationId}`, 
      request
    );
    return response.data;
  },

  // Get activation logs for an integration
  getActivationLogs: async (integrationId: number, page = 1, pageSize = 50) => {
    const response = await api.get<SasActivationLog[]>(
      `/api/SasActivations/${integrationId}`,
      {
        params: { page, pageSize }
      }
    );
    return response.data;
  },

  // Get a single activation log
  getActivationLog: async (logId: number) => {
    const response = await api.get<SasActivationLog>(`/api/SasActivations/log/${logId}`);
    return response.data;
  },

  // Retry failed activations
  retryFailedActivations: async (integrationId: number, fromDate?: string) => {
    const response = await api.post<RetryResponse>(
      `/api/SasActivations/${integrationId}/retry-failed`,
      null,
      {
        params: fromDate ? { fromDate } : undefined
      }
    );
    return response.data;
  }
};
