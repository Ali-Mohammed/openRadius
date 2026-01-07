import { apiClient } from '../lib/api'

export interface CustomWallet {
  id?: number
  name: string
  description?: string
  maxFillLimit: number
  dailySpendingLimit: number
  type: string
  status: string
  color?: string
  icon?: string
  currentBalance?: number
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
}

export interface CustomWalletType {
  value: string
  label: string
  description: string
  icon: string
  color: string
}

export interface CustomWalletStatus {
  value: string
  label: string
  color: string
}

export interface CustomWalletResponse {
  data: CustomWallet[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export const customWalletApi = {
  getAll: async (params?: {
    search?: string
    type?: string
    status?: string
    page?: number
    pageSize?: number
  }): Promise<CustomWalletResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append('search', params.search)
    if (params?.type) queryParams.append('type', params.type)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())

    const response = await apiClient.get<CustomWalletResponse>(
      `/api/custom-wallets?${queryParams.toString()}`
    )
    return response.data
  },

  getById: async (id: number): Promise<CustomWallet> => {
    const response = await apiClient.get<CustomWallet>(`/api/custom-wallets/${id}`)
    return response.data
  },

  create: async (wallet: CustomWallet): Promise<CustomWallet> => {
    const response = await apiClient.post<CustomWallet>('/api/custom-wallets', wallet)
    return response.data
  },

  update: async (id: number, wallet: CustomWallet): Promise<CustomWallet> => {
    const response = await apiClient.put<CustomWallet>(`/api/custom-wallets/${id}`, wallet)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/custom-wallets/${id}`)
  },

  getTypes: async (): Promise<CustomWalletType[]> => {
    const response = await apiClient.get<CustomWalletType[]>('/api/custom-wallets/types')
    return response.data
  },

  getStatuses: async (): Promise<CustomWalletStatus[]> => {
    const response = await apiClient.get<CustomWalletStatus[]>('/api/custom-wallets/statuses')
    return response.data
  },

  reorder: async (sortOrders: { id: number; sortOrder: number }[]): Promise<void> => {
    await apiClient.post('/api/custom-wallets/reorder', sortOrders)
  },
}
