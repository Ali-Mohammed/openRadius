import { apiClient } from '../lib/api';

export interface BillingGroup {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  userCount?: number;
  userIds?: number[];
}

export interface CreateBillingGroupRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  userIds?: number[];
}

export interface UpdateBillingGroupRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  userIds?: number[];
}

export interface BillingGroupsResponse {
  data: BillingGroup[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getGroups = async (params?: {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}): Promise<BillingGroupsResponse> => {
  const response = await apiClient.get('/api/billinggroup', { params });
  return response.data;
};

export const getGroupById = async (id: number): Promise<BillingGroup> => {
  const response = await apiClient.get(`/api/billinggroup/${id}`);
  return response.data;
};

export const createGroup = async (data: CreateBillingGroupRequest): Promise<BillingGroup> => {
  const response = await apiClient.post('/api/billinggroup', data);
  return response.data;
};

export const updateGroup = async (id: number, data: UpdateBillingGroupRequest): Promise<BillingGroup> => {
  const response = await apiClient.put(`/api/billinggroup/${id}`, data);
  return response.data;
};

export const deleteGroup = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/billinggroup/${id}`);
};

export const restoreGroup = async (id: number): Promise<BillingGroup> => {
  const response = await apiClient.post(`/api/billinggroup/${id}/restore`);
  return response.data;
};
