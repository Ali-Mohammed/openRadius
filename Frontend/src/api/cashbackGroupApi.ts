import { apiClient } from '../lib/api'

export interface CashbackGroup {
  id: number
  name: string
  icon?: string
  color?: string
  disabled: boolean
  userCount: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
  deletedBy?: string
}

export interface CashbackGroupPaginatedResponse {
  data: CashbackGroup[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export interface CreateCashbackGroupData {
  name: string
  icon?: string
  color?: string
  disabled?: boolean
  userIds?: number[]
}

export interface UpdateCashbackGroupData {
  name?: string
  icon?: string
  color?: string
  disabled?: boolean
  userIds?: number[]
}

export const cashbackGroupApi = {
  getAll: async (params: {
    page?: number
    pageSize?: number
    search?: string
    sortField?: string
    sortDirection?: string
    onlyDeleted?: boolean
  }): Promise<CashbackGroupPaginatedResponse> => {
    const response = await apiClient.get('/api/billing/cashback-groups', { params })
    return response.data
  },

  getById: async (id: number): Promise<CashbackGroup> => {
    const response = await apiClient.get(`/api/billing/cashback-groups/${id}`)
    return response.data
  },

  getGroupUsers: async (id: number): Promise<number[]> => {
    const response = await apiClient.get(`/api/billing/cashback-groups/${id}/users`)
    return response.data
  },

  create: async (data: CreateCashbackGroupData): Promise<CashbackGroup> => {
    const response = await apiClient.post('/api/billing/cashback-groups', data)
    return response.data
  },

  update: async (id: number, data: UpdateCashbackGroupData): Promise<CashbackGroup> => {
    const response = await apiClient.put(`/api/billing/cashback-groups/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/billing/cashback-groups/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/billing/cashback-groups/${id}/restore`)
  },
}
