import { apiClient } from '../lib/api'

export interface Addon {
  id?: number
  name: string
  description?: string
  icon?: string
  color?: string
  price: number
  customWalletId: number
  customWalletName?: string
  isDeleted?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AddonResponse {
  data: Addon[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export const addonApi = {
  getAll: async (params?: {
    search?: string
    customWalletId?: number
    page?: number
    pageSize?: number
    includeDeleted?: boolean
  }): Promise<AddonResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append('search', params.search)
    if (params?.customWalletId) queryParams.append('customWalletId', params.customWalletId.toString())
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.includeDeleted) queryParams.append('includeDeleted', params.includeDeleted.toString())

    const response = await apiClient.get<AddonResponse>(
      `/api/addons?${queryParams.toString()}`
    )
    return response.data
  },

  getById: async (id: number): Promise<Addon> => {
    const response = await apiClient.get<Addon>(`/api/addons/${id}`)
    return response.data
  },

  create: async (addon: Addon): Promise<Addon> => {
    const response = await apiClient.post<Addon>('/api/addons', addon)
    return response.data
  },

  update: async (id: number, addon: Addon): Promise<void> => {
    await apiClient.put(`/api/addons/${id}`, addon)
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/addons/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/addons/${id}/restore`)
  },
}
