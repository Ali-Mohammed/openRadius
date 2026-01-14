import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface CashbackProfileAmount {
  id: number;
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
    const response = await axios.get(`${API_URL}/api/CashbackProfileAmount`, {
      params: { groupId: cashbackGroupId }
    });
    return response.data;
  },

  saveAmounts: async (request: SaveCashbackAmountsRequest): Promise<void> => {
    await axios.post(`${API_URL}/api/CashbackProfileAmount`, request);
  }
};
