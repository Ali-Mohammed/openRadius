import { apiClient } from '../lib/api'
import type { TransactionType } from '../constants/transactionTypes'

export interface Transaction {
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
  status: 'completed' | 'pending' | 'cancelled' | 'reversed'
  balanceBefore: number
  balanceAfter: number
  description?: string
  reason?: string
  reference?: string
  paymentMethod?: string
  relatedTransactionId?: number
  isDeleted?: boolean
  deletedAt?: string
  deletedBy?: string
  createdAt: string
  createdBy?: string
  // RADIUS activation related fields
  radiusUserId?: number
  radiusUsername?: string
  radiusProfileId?: number
  radiusProfileName?: string
  billingProfileId?: number
  billingProfileName?: string
}

export interface CreateTransactionRequest {
  walletType: 'custom' | 'user'
  customWalletId?: number
  userWalletId?: number
  transactionType: TransactionType
  amount: number
  description?: string
  reason?: string
  reference?: string
  paymentMethod?: string
}

export interface TransactionFilters {
  walletType?: 'custom' | 'user'
  customWalletId?: number
  userWalletId?: number
  userId?: number
  transactionType?: string
  status?: string
  startDate?: string
  endDate?: string
  includeDeleted?: boolean
  page?: number
  pageSize?: number
}

export interface TransactionResponse {
  data: Transaction[]
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface TransactionStats {
  totalTransactions: number
  totalCredit: number
  totalDebit: number
  netAmount: number
  byType: {
    transactionType: string
    totalAmount: number
    count: number
  }[]
}
export interface TransactionComment {
  id: number
  comment: string
  tags?: string
  attachments?: string
  createdBy: string
  createdAt: string
}

export interface CommentsResponse {
  data: TransactionComment[]
  totalCount: number
}

export interface TransactionHistoryItem {
  id: number
  action: string
  changes?: string
  performedBy: string
  performedAt: string
}

export interface HistoryResponse {
  data: TransactionHistoryItem[]
  totalCount: number
}

export interface TransactionHistory {
  id: number
  action: string
  changes?: string
  performedBy: string
  performedAt: string
}

export interface CommentsResponse {
  data: TransactionComment[]
  totalCount: number
}

export interface HistoryResponse {
  data: TransactionHistory[]
  totalCount: number
}

const transactionApi = {
  getAll: async (filters?: TransactionFilters): Promise<TransactionResponse> => {
    const params = new URLSearchParams()
    if (filters?.walletType) params.append('walletType', filters.walletType)
    if (filters?.customWalletId) params.append('customWalletId', filters.customWalletId.toString())
    if (filters?.userWalletId) params.append('userWalletId', filters.userWalletId.toString())
    if (filters?.userId) params.append('userId', filters.userId.toString())
    if (filters?.transactionType) params.append('transactionType', filters.transactionType)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    // Always send includeDeleted parameter explicitly
    params.append('includeDeleted', (filters?.includeDeleted ?? false).toString())
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString())

    const response = await apiClient.get(`/api/transactions?${params}`)
    return response.data
  },

  getById: async (id: number): Promise<Transaction> => {
    const response = await apiClient.get(`/api/transactions/${id}`)
    return response.data
  },

  create: async (transaction: CreateTransactionRequest): Promise<Transaction> => {
    const response = await apiClient.post('/api/transactions', transaction)
    return response.data
  },

  delete: async (id: number, reason?: string): Promise<void> => {
    await apiClient.delete(`/api/transactions/${id}`, {
      data: { reason }
    })
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/transactions/${id}/restore`)
  },

  bulkDelete: async (ids: number[], reason?: string): Promise<any> => {
    const response = await apiClient.post(`/api/transactions/bulk-delete`, { ids, reason })
    return response.data
  },

  bulkRestore: async (ids: number[]): Promise<any> => {
    const response = await apiClient.post(`/api/transactions/bulk-restore`, { ids })
    return response.data
  },

  getStats: async (filters?: Omit<TransactionFilters, 'page' | 'pageSize'>): Promise<TransactionStats> => {
    const params = new URLSearchParams()
    if (filters?.walletType) params.append('walletType', filters.walletType)
    if (filters?.customWalletId) params.append('customWalletId', filters.customWalletId.toString())
    if (filters?.userWalletId) params.append('userWalletId', filters.userWalletId.toString())
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)

    const response = await apiClient.get(`/api/transactions/stats?${params}`)
    return response.data
  },

  // Comments
  getComments: async (transactionId: number): Promise<CommentsResponse> => {
    const response = await apiClient.get(`/api/transactions/${transactionId}/comments`)
    return response.data
  },

  addComment: async (
    transactionId: number, 
    comment: string, 
    tags?: string[], 
    attachments?: string[]
  ): Promise<TransactionComment> => {
    const response = await apiClient.post(`/api/transactions/${transactionId}/comments`, { 
      comment,
      tags,
      attachments
    })
    return response.data
  },

  // History
  getHistory: async (transactionId: number): Promise<HistoryResponse> => {
    const response = await apiClient.get(`/api/transactions/${transactionId}/history`)
    return response.data
  },
}

export default transactionApi
