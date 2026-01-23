import { api } from '../lib/api';

export interface ActivationHistory {
  id: number;
  radiusActivationId: number;
  billingProfileId?: number;
  billingProfileName?: string;
  radiusUserId: number;
  radiusUsername?: string;
  actionById?: number;
  actionByUsername?: string;
  actionForId?: number;
  actionForUsername?: string;
  isActionBehalf: boolean;
  amount?: number;
  cashbackAmount?: number;
  activationType?: string;
  activationStatus?: string;
  paymentMethod?: string;
  previousExpireDate?: string;
  newExpireDate?: string;
  durationDays?: number;
  radiusProfileId?: number;
  radiusProfileName?: string;
  transactionId?: number;
  source?: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
  walletDistribution?: string;
  createdAt: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
}

export interface ActivationHistoryStats {
  totalActivations: number;
  totalRevenue: number;
  totalCashback: number;
  netRevenue: number;
  byType: Array<{
    type: string;
    count: number;
    totalAmount: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  byPaymentMethod: Array<{
    paymentMethod: string;
    count: number;
    totalAmount: number;
  }>;
}

export interface GetActivationHistoriesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  billingProfileId?: number;
  radiusUserId?: number;
  activationType?: string;
  activationStatus?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export const activationHistoryApi = {
  getActivationHistories: async (params: GetActivationHistoriesParams = {}) => {
    const response = await api.get<{
      data: ActivationHistory[];
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    }>('/api/activationhistory', { params });
    return response.data;
  },

  getActivationHistory: async (id: number) => {
    const response = await api.get<ActivationHistory>(`/api/activationhistory/${id}`);
    return response.data;
  },

  getBillingProfileActivationHistories: async (
    billingProfileId: number,
    params: {
      page?: number;
      pageSize?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ) => {
    const response = await api.get<{
      data: ActivationHistory[];
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    }>(`/api/activationhistory/billing-profile/${billingProfileId}`, { params });
    return response.data;
  },

  getActivationHistoryStats: async (params: {
    billingProfileId?: number;
    startDate?: string;
    endDate?: string;
  } = {}) => {
    const response = await api.get<ActivationHistoryStats>('/api/activationhistory/stats', { params });
    return response.data;
  },
};
