import api from './api';

export interface InitiatePaymentRequest {
  paymentMethodId: number;
  amount: number;
  serviceType?: string;
}

export interface PaymentInitiationResponse {
  success: boolean;
  paymentUrl?: string;
  transactionId?: string;
  errorMessage?: string;
  additionalData?: any;
}

export interface PaymentStatus {
  transactionId: string;
  status: string;
  amount: number;
  currency: string;
  gateway: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface WalletBalance {
  currentBalance: number;
  status: string;
  dailySpendingLimit?: number;
  maxFillLimit?: number;
}

export const paymentApi = {
  initiatePayment: async (data: InitiatePaymentRequest): Promise<PaymentInitiationResponse> => {
    const response = await api.post('/payments/initiate', data);
    return response.data;
  },

  getPaymentStatus: async (transactionId: string): Promise<PaymentStatus> => {
    const response = await api.get(`/payments/status/${transactionId}`);
    return response.data;
  },

  getWalletBalance: async (): Promise<WalletBalance> => {
    const response = await api.get('/payments/wallet/balance');
    return response.data;
  }
};
