import { apiClient } from '../lib/api';

export interface Automation {
  id: number;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  status: string; // draft, active, paused, inactive
  isActive: boolean;
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
}

export interface UpdateAutomationRequest {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: string;
  isActive?: boolean;
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
