import { apiClient } from '../lib/api';

export interface BillingProfileWallet {
  id?: number;
  walletType: string;
  userWalletId?: number;
  customWalletId?: number;
  price: number;
  icon?: string;
  color?: string;
  direction?: string;
  displayOrder?: number;
}

export interface BillingProfileAddon {
  id?: number;
  title: string;
  description?: string;
  price: number;
  displayOrder?: number;
}

export interface BillingProfile {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  price?: number;
  radiusProfileId?: number | null;
  billingGroupId: number;
  automationId?: number | null;
  automationTitle?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
  userIds?: number[]; // Direct user assignments
  wallets: BillingProfileWallet[];
  addons: BillingProfileAddon[];
  
  // Advanced Options
  isOffer?: boolean;
  platform?: 'Web' | 'MobileApp' | 'Both' | null;
  totalQuantity?: number | null;
  usedQuantity?: number;
  userType?: 'New' | 'Renew' | 'Both' | null;
  expirationDays?: number | null;
  offerStartDate?: string | null;
  offerEndDate?: string | null;
  requiresApproval?: boolean;
  priority?: number | null;
  color?: string | null;
  icon?: string | null;
}

export interface CreateBillingProfileRequest {
  name: string;
  description?: string;
  price?: number;
  radiusProfileId?: number | null;
  billingGroupId: number;
  automationId?: number | null;
  isActive?: boolean;
  userIds?: number[]; // Direct user assignments
  wallets?: BillingProfileWallet[];
  addons?: BillingProfileAddon[];
  
  // Advanced Options
  isOffer?: boolean;
  platform?: 'Web' | 'MobileApp' | 'Both' | null;
  totalQuantity?: number | null;
  userType?: 'New' | 'Renew' | 'Both' | null;
  expirationDays?: number | null;
  offerStartDate?: string | null;
  offerEndDate?: string | null;
  requiresApproval?: boolean;
  priority?: number | null;
  color?: string | null;
  icon?: string | null;
}

export interface UpdateBillingProfileRequest {
  name: string;
  description?: string;
  price?: number;
  radiusProfileId?: number | null;
  billingGroupId: number;
  automationId?: number | null;
  isActive?: boolean;
  userIds?: number[]; // Direct user assignments
  wallets?: BillingProfileWallet[];
  addons?: BillingProfileAddon[];
  
  // Advanced Options
  isOffer?: boolean;
  platform?: 'Web' | 'MobileApp' | 'Both' | null;
  totalQuantity?: number | null;
  userType?: 'New' | 'Renew' | 'Both' | null;
  expirationDays?: number | null;
  offerStartDate?: string | null;
  offerEndDate?: string | null;
  requiresApproval?: boolean;
  priority?: number | null;
  color?: string | null;
  icon?: string | null;
}

export interface BillingProfilesResponse {
  data: BillingProfile[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export const getProfiles = async (params?: {
  search?: string;
  radiusProfileId?: number;
  billingGroupId?: number;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
  isActive?: boolean;
}): Promise<BillingProfilesResponse> => {
  const response = await apiClient.get('/api/billingprofile', { params });
  return response.data;
};

export const getProfileById = async (id: number): Promise<BillingProfile> => {
  const response = await apiClient.get(`/api/billingprofile/${id}`);
  return response.data;
};

export const createProfile = async (data: CreateBillingProfileRequest): Promise<BillingProfile> => {
  const response = await apiClient.post('/api/billingprofile', data);
  return response.data;
};

export const updateProfile = async (id: number, data: UpdateBillingProfileRequest): Promise<BillingProfile> => {
  const response = await apiClient.put(`/api/billingprofile/${id}`, data);
  return response.data;
};

export const deleteProfile = async (id: number): Promise<void> => {
  await apiClient.delete(`/api/billingprofile/${id}`);
};

export const restoreProfile = async (id: number): Promise<BillingProfile> => {
  const response = await apiClient.post(`/api/billingprofile/${id}/restore`);
  return response.data;
};

export const toggleActive = async (id: number): Promise<BillingProfile> => {
  const response = await apiClient.post(`/api/billingprofile/${id}/toggle-active`);
  return response.data;
};

export const reorderProfiles = async (items: { id: number; priority: number }[]): Promise<void> => {
  await apiClient.post('/api/billingprofile/reorder', items);
};
