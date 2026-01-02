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
  createdAt?: string
  updatedAt?: string
  lastSyncedAt?: string
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
    instantId: number,
    page: number = 1,
    pageSize: number = 50,
    search?: string
  ): Promise<PaginatedProfilesResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    if (search) {
      params.append('search', search)
    }
    const response = await apiClient.get(`/api/instants/${instantId}/radius/profiles?${params.toString()}`)
    return response.data
  },

  getById: async (instantId: number, id: number): Promise<RadiusProfile> => {
    const response = await apiClient.get(`/api/instants/${instantId}/radius/profiles/${id}`)
    return response.data
  },

  create: async (instantId: number, data: RadiusProfile): Promise<RadiusProfile> => {
    const response = await apiClient.post(`/api/instants/${instantId}/radius/profiles`, data)
    return response.data
  },

  update: async (instantId: number, id: number, data: RadiusProfile): Promise<void> => {
    await apiClient.put(`/api/instants/${instantId}/radius/profiles/${id}`, { ...data, id })
  },

  delete: async (instantId: number, id: number): Promise<void> => {
    await apiClient.delete(`/api/instants/${instantId}/radius/profiles/${id}`)
  },

  sync: async (instantId: number): Promise<SyncProfileResponse> => {
    const response = await apiClient.post(`/api/instants/${instantId}/radius/profiles/sync`)
    return response.data
  },
}
