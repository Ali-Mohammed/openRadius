import { apiClient } from '@/lib/api';

export interface UserCashback {
  id: number;
  userId: number;
  billingProfileId: number;
  amount: number;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  user?: {
    id: number;
    username: string;
    email: string;
  };
  billingProfile?: {
    id: number;
    name: string;
    price: number;
  };
}

export interface CashbackAmountItem {
  billingProfileId: number;
  amount: number;
}

export interface SaveUserCashbacksRequest {
  userId: number;
  amounts: CashbackAmountItem[];
}

export const userCashbackApi = {
  // Get cashbacks by user ID
  getByUser: async (userId: number): Promise<UserCashback[]> => {
    const response = await apiClient.get<UserCashback[]>(`/api/UserCashback?userId=${userId}`);
    return response.data;
  },

  // Get all cashbacks (with user and billing profile details)
  getAll: async (): Promise<UserCashback[]> => {
    const response = await apiClient.get<UserCashback[]>('/api/UserCashback/all');
    return response.data;
  },

  // Get user IDs that have individual cashback settings
  getUserIdsWithCashbacks: async (): Promise<number[]> => {
    const response = await apiClient.get<number[]>('/api/UserCashback/user-ids');
    return response.data;
  },

  // Save cashbacks for a user (create/update)
  save: async (request: SaveUserCashbacksRequest): Promise<void> => {
    await apiClient.post('/api/UserCashback', request);
  },

  // Delete single cashback
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/UserCashback/${id}`);
  },

  // Delete all cashbacks for a user
  deleteByUser: async (userId: number): Promise<void> => {
    await apiClient.delete(`/api/UserCashback/user/${userId}`);
  },

  // Calculate the effective cashback amount for a user and billing profile
  calculateCashback: async (userId: number, billingProfileId: number): Promise<{
    userId: number;
    billingProfileId: number;
    cashbackAmount: number;
    source: 'none' | 'individual' | 'group';
  }> => {
    const response = await apiClient.get('/api/UserCashback/calculate', {
      params: { userId, billingProfileId }
    });
    return response.data;
  },
};
