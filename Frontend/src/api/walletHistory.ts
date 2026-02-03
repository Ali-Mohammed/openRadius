import { apiClient } from '../lib/api'
import type { TransactionType } from '../constants/transactionTypes'

export interface WalletHistory {
  id: number
  walletType: 'custom' | 'user'
  customWalletId?: number
  customWalletName?: string
  userWalletId?: number
  userId?: number
  userEmail?: string
  userName?: string
  transactionType: TransactionType
  amountType: 'credit' | 'debit'
  amount: number
  balanceBefore: number
  balanceAfter: number
  description?: string
  reason?: string
  reference?: string
  createdAt: string
  createdBy?: string
}

export interface WalletHistoryFilters {
  walletType?: 'custom' | 'user'
  customWalletId?: number
  userWalletId?: number
  userId?: number
  transactionType?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface WalletHistoryResponse {
  data: WalletHistory[]
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface WalletHistoryStats {
  totalTransactions: number
  totalAmount: number
  byType: {
    transactionType: string
    totalAmount: number
    count: number
  }[]
}

const walletHistoryApi = {
  getAll: async (filters?: WalletHistoryFilters): Promise<WalletHistoryResponse> => {
    const params = new URLSearchParams()
    if (filters?.walletType) params.append('walletType', filters.walletType)
    if (filters?.customWalletId) params.append('customWalletId', filters.customWalletId.toString())
    if (filters?.userWalletId) params.append('userWalletId', filters.userWalletId.toString())
    if (filters?.userId) params.append('userId', filters.userId.toString())
    if (filters?.transactionType) params.append('transactionType', filters.transactionType)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString())

    const response = await apiClient.get(`/api/wallet-history?${params}`)
    return response.data
  },

  getByUser: async (userId: number, page = 1, pageSize = 50): Promise<WalletHistoryResponse> => {
    const params = new URLSearchParams()
    params.append('userId', userId.toString())
    params.append('page', page.toString())
    params.append('pageSize', pageSize.toString())

    const response = await apiClient.get(`/api/wallet-history?${params}`)
    return response.data
  },

  getStats: async (filters?: Omit<WalletHistoryFilters, 'page' | 'pageSize'>): Promise<WalletHistoryStats> => {
    const params = new URLSearchParams()
    if (filters?.walletType) params.append('walletType', filters.walletType)
    if (filters?.customWalletId) params.append('customWalletId', filters.customWalletId.toString())
    if (filters?.userWalletId) params.append('userWalletId', filters.userWalletId.toString())
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)

    const response = await apiClient.get(`/api/wallet-history/stats?${params}`)
    return response.data
  },
}

export default walletHistoryApi
