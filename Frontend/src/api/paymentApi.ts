import { apiClient } from '../lib/api';

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

export interface PaymentLog {
  uuid: string;
  transactionId: string;
  gateway: string;
  amount: number;
  currency: string;
  status: string;
  referenceId?: string;
  gatewayTransactionId?: string;
  errorMessage?: string;
  environment?: string;
  createdAt: string;
  updatedAt?: string;
  userName?: string;
  userEmail?: string;
}

export interface PaymentInquiryLiveData {
  success: boolean;
  gatewayStatus?: string;
  rawResponse?: any;
  errorMessage?: string;
  queriedAt: string;
}

export interface PaymentInquiryResponse {
  uuid: string;
  transactionId: string;
  gateway: string;
  amount: number;
  currency: string;
  status: string;
  referenceId?: string;
  gatewayTransactionId?: string;
  environment?: string;
  errorMessage?: string;
  serviceType?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  requestData?: any;
  responseData?: any;
  callbackData?: any;
  liveData?: PaymentInquiryLiveData;
}

export const paymentApi = {
  initiatePayment: async (data: InitiatePaymentRequest): Promise<PaymentInitiationResponse> => {
    const response = await apiClient.post('/api/payments/initiate', data);
    return response.data;
  },

  getPaymentStatus: async (transactionId: string): Promise<PaymentStatus> => {
    const response = await apiClient.get(`/api/payments/status/${transactionId}`);
    return response.data;
  },

  getWalletBalance: async (): Promise<WalletBalance> => {
    const response = await apiClient.get('/api/payments/wallet/balance');
    return response.data;
  },

  getPaymentHistory: async (params?: { pageNumber?: number; pageSize?: number; status?: string }): Promise<PaymentLog[]> => {
    const response = await apiClient.get('/api/payments/history', { params });
    return response.data;
  },

  inquirePayment: async (uuid: string): Promise<PaymentInquiryResponse> => {
    const response = await apiClient.get(`/api/payments/${uuid}/inquiry`);
    return response.data;
  }
};
