import { apiClient } from '../lib/api'

export interface RadiusUser {
  id?: number
  externalId?: number
  username: string
  firstname?: string
  lastname?: string
  city?: string
  phone?: string
  email?: string
  profileId?: number
  balance: number
  loanBalance?: number
  expiration?: string
  lastOnline?: string
  enabled: boolean
  onlineStatus?: number
  remainingDays?: number
  debtDays?: number
  staticIp?: string
  company?: string
  address?: string
  contractId?: string
  simultaneousSessions?: number
  createdAt?: string
  updatedAt?: string
  lastSyncedAt?: string
}

export interface SyncUsersResponse {
  syncId: string
  success: boolean
  message?: string
  totalUsers: number
  newUsers: number
  updatedUsers: number
  failedUsers: number
  startedAt: string
  completedAt?: string
  errorMessage?: string
}

export const radiusUserApi = {
  getAll: async (instantId: number): Promise<RadiusUser[]> => {
    const response = await apiClient.get(`/api/instants/${instantId}/radius/users`)
    return response.data
  },

  getById: async (instantId: number, id: number): Promise<RadiusUser> => {
    const response = await apiClient.get(`/api/instants/${instantId}/radius/users/${id}`)
    return response.data
  },

  create: async (instantId: number, data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.post(`/api/instants/${instantId}/radius/users`, data)
    return response.data
  },

  update: async (instantId: number, id: number, data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.put(`/api/instants/${instantId}/radius/users/${id}`, data)
    return response.data
  },

  delete: async (instantId: number, id: number): Promise<void> => {
    await apiClient.delete(`/api/instants/${instantId}/radius/users/${id}`)
  },

  sync: async (instantId: number): Promise<SyncUsersResponse> => {
    const response = await apiClient.post(`/api/instants/${instantId}/radius/users/sync`)
    return response.data
  },
}
