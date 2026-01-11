import { apiClient } from '../lib/api'

export interface RadiusProfile {
  id?: number
  externalId?: number
  name: string
  enabled: boolean
  type: number
  downrate: number
  uprate: number
  pool?: string
  price: number
  monthly: number
  burstEnabled: boolean
  limitExpiration: boolean
  expirationAmount: number
  expirationUnit: number
  siteId?: number
  onlineUsersCount?: number
  usersCount?: number
  userCount?: number  // Alias for usersCount
  color?: string
  icon?: string
  createdAt?: string
  updatedAt?: string
  lastSyncedAt?: string
  customWallets?: ProfileWalletConfig[]
}

export interface ProfileWalletConfig {
  customWalletId: number
  amount: number
  walletName?: string
}

export interface SyncProfileResponse {
  syncId: string
  success: boolean
  message?: string
  totalProfiles: number
  newProfiles: number
  updatedProfiles: number
  failedProfiles: number
  startedAt: string
  completedAt?: string
  errorMessage?: string
}

export interface PaginatedProfilesResponse {
  data: RadiusProfile[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export const radiusProfileApi = {
  getAll: async (
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<PaginatedProfilesResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    if (search) {
      params.append('search', search)
    }
    if (sortField && sortDirection) {
      params.append('sortField', sortField)
      params.append('sortDirection', sortDirection)
    }
    const response = await apiClient.get(`/api/radius/profiles?${params.toString()}`)
    return response.data
  },

  getById: async (id: number): Promise<RadiusProfile> => {
    const response = await apiClient.get(`/api/radius/profiles/${id}`)
    return response.data
  },

  create: async (data: RadiusProfile): Promise<RadiusProfile> => {
    const response = await apiClient.post(`/api/radius/profiles`, data)
    return response.data
  },

  update: async (id: number, data: RadiusProfile): Promise<void> => {
    await apiClient.put(`/api/radius/profiles/${id}`, { ...data, id })
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/radius/profiles/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/radius/profiles/${id}/restore`)
  },

  getTrash: async (
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedProfilesResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/radius/profiles/trash?${params.toString()}`)
    return response.data
  },

  sync: async (): Promise<SyncProfileResponse> => {
    const response = await apiClient.post(`/api/radius/profiles/sync`)
    return response.data
  },
}

