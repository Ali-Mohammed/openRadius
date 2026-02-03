import { apiClient } from '../lib/api';

export interface CashbackProfileAmount {
  id: number;
  uuid: string;
  cashbackGroupId: number;
  billingProfileId: number;
  amount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface SaveCashbackAmountsRequest {
  cashbackGroupId: number;
  amounts: {
    billingProfileId: number;
    amount: number;
  }[];
}

export const cashbackProfileAmountApi = {
  getAmounts: async (cashbackGroupId: number): Promise<CashbackProfileAmount[]> => {
    const response = await apiClient.get('/api/CashbackProfileAmount', {
      params: { groupId: cashbackGroupId }
    });
    return response.data;
  },

  saveAmounts: async (request: SaveCashbackAmountsRequest): Promise<void> => {
    await apiClient.post('/api/CashbackProfileAmount', request);
  },

  resetGroup: async (groupId: number): Promise<void> => {
    await apiClient.delete(`/api/CashbackProfileAmount/group/${groupId}`);
  }
};
