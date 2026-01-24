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
  pendingCashback?: number
  // Cashback Group
  cashbackGroupId?: number | null
  cashbackGroupName?: string | null
  // User-specific cashback
  hasUserCashback?: boolean
  // Custom Cashback Settings
  usesCustomCashbackSetting?: boolean
  customCashbackType?: string | null
  customCashbackCollectionSchedule?: string | null
  customCashbackMinimumCollectionAmount?: number | null
  customCashbackRequiresApproval?: boolean | null
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
    console.log('Creating user wallet with data:', wallet)
    const response = await apiClient.post<UserWallet>('/api/user-wallets', wallet)
    console.log('Create response:', response.data)
    return response.data
  },

  async update(id: number, wallet: Partial<UserWallet>): Promise<void> {
    await apiClient.put(`/api/user-wallets/${id}`, { ...wallet, id })
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/user-wallets/${id}`)
  },

  async getMyWallet(): Promise<{ 
    hasWallet: boolean; 
    id?: number; 
    userId?: number;
    userName?: string;
    customWalletId?: number;
    customWalletName?: string;
    currentBalance?: number; 
    status?: string; 
    allowNegativeBalance?: boolean; 
    message?: string 
  }> {
    const response = await apiClient.get('/api/user-wallets/my-wallet')
    return response.data
  },
}

export default userWalletApi
