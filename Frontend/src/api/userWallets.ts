import { apiClient } from '../lib/api'

export interface UserWallet {
  id?: number
  userId: number
  userEmail?: string
  userName?: string
  customWalletId: number
  customWalletName?: string
  customWalletType?: string
  customWalletColor?: string
  customWalletIcon?: string
  currentBalance: number
  maxFillLimit?: number | null
  dailySpendingLimit?: number | null
  status: string
  allowNegativeBalance?: boolean | null
  createdAt?: string
  updatedAt?: string
}

export interface UserWalletListResponse {
  data: UserWallet[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface UserWalletFilters {
  userId?: number
  customWalletId?: number
  status?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface BalanceAdjustment {
  amount: number
  reason?: string
}

export interface BalanceAdjustmentResponse {
  id: number
  previousBalance: number
  newBalance: number
  adjustment: number
}

const userWalletApi = {
  async getAll(filters?: UserWalletFilters): Promise<UserWalletListResponse> {
    const params = new URLSearchParams()
    if (filters?.userId) params.append('userId', filters.userId.toString())
    if (filters?.customWalletId) params.append('customWalletId', filters.customWalletId.toString())
    if (filters?.status) params.append('status', filters.status)
    if (filters?.search) params.append('search', filters.search)
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString())

    const response = await apiClient.get<UserWalletListResponse>(
      `/api/user-wallets${params.toString() ? `?${params.toString()}` : ''}`
    )
    return response.data
  },

  async getById(id: number): Promise<UserWallet> {
    const response = await apiClient.get<UserWallet>(`/api/user-wallets/${id}`)
    return response.data
  },

  async create(wallet: Partial<UserWallet>): Promise<UserWallet> {
    const response = await apiClient.post<UserWallet>('/api/user-wallets', wallet)
    return response.data
  },

  async update(id: number, wallet: Partial<UserWallet>): Promise<void> {
    await apiClient.put(`/api/user-wallets/${id}`, { ...wallet, id })
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/user-wallets/${id}`)
  },

  async adjustBalance(id: number, adjustment: BalanceAdjustment): Promise<BalanceAdjustmentResponse> {
    const response = await apiClient.post<BalanceAdjustmentResponse>(
      `/api/user-wallets/${id}/adjust-balance`,
      adjustment
    )
    return response.data
  },
}

export default userWalletApi
