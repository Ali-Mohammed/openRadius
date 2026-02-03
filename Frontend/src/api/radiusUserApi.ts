import { apiClient } from '../lib/api'
import type { FilterGroup } from '@/components/QueryBuilder'

export interface RadiusTag {
  id: number
  title: string
  tagName?: string  // Alias for title for backward compatibility
  description?: string
  status: string
  color: string
  icon?: string
  createdAt?: string
  updatedAt?: string
}

export interface RadiusUser {
  id?: number
  uuid: string
  externalId?: number
  username: string
  firstname?: string
  lastname?: string
  city?: string
  phone?: string
  email?: string
  profileId?: number
  profileName?: string
  profileBillingId?: number
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
  notes?: string
  deviceSerialNumber?: string
  gpsLat?: string
  gpsLng?: string
  simultaneousSessions?: number
  zoneId?: number
  zoneName?: string
  zoneColor?: string
  groupId?: number
  groupName?: string
  createdAt?: string
  updatedAt?: string
  lastSyncedAt?: string
  tags?: RadiusTag[]
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

export interface PaginatedUsersResponse {
  data: RadiusUser[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export interface FieldSuggestion {
  value: string
  label: string
  color?: string
  icon?: string
}

export const radiusUserApi = {
  getAll: async (
    page: number = 1, 
    pageSize: number = 50,
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc',
    filters?: FilterGroup | null
  ): Promise<PaginatedUsersResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    if (search) {
      params.append('search', search)
    }
    if (sortField) {
      params.append('sortField', sortField)
    }
    if (sortDirection) {
      params.append('sortDirection', sortDirection)
    }
    if (filters && filters.conditions && filters.conditions.length > 0) {
      params.append('filters', JSON.stringify(filters))
    }
    const response = await apiClient.get(`/api/radius/users?${params.toString()}`)
    return response.data
  },

  getSuggestions: async (field: string, search?: string, limit: number = 20): Promise<{ field: string; suggestions: string[] | FieldSuggestion[] }> => {
    const params = new URLSearchParams({ field })
    if (search) params.append('search', search)
    if (limit) params.append('limit', limit.toString())
    const response = await apiClient.get(`/api/radius/users/suggestions?${params.toString()}`)
    return response.data
  },

  getById: async (id: number): Promise<RadiusUser> => {
    const response = await apiClient.get(`/api/radius/users/${id}`)
    return response.data
  },

  getByUuid: async (uuid: string): Promise<RadiusUser> => {
    const response = await apiClient.get(`/api/radius/users/uuid/${uuid}`)
    return response.data
  },

  create: async (data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.post(`/api/radius/users`, data)
    return response.data
  },

  update: async (id: number, data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.put(`/api/radius/users/${id}`, data)
    return response.data
  },

  updateByUuid: async (uuid: string, data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.put(`/api/radius/users/uuid/${uuid}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/radius/users/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/radius/users/${id}/restore`)
  },

  getTrash: async (
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedUsersResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/radius/users/trash?${params.toString()}`)
    return response.data
  },

  sync: async (): Promise<SyncUsersResponse> => {
    const response = await apiClient.post(`/api/radius/users/sync`)
    return response.data
  },

  exportToCsv: async (
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc',
    filters?: string
  ): Promise<Blob> => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (sortField) params.append('sortField', sortField)
    if (sortDirection) params.append('sortDirection', sortDirection)
    if (filters) params.append('filters', filters)
    
    const response = await apiClient.get(
      `/api/radius/users/export/csv?${params.toString()}`,
      { responseType: 'blob' }
    )
    return response.data
  },

  exportToExcel: async (
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc',
    filters?: string
  ): Promise<Blob> => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (sortField) params.append('sortField', sortField)
    if (sortDirection) params.append('sortDirection', sortDirection)
    if (filters) params.append('filters', filters)
    
    const response = await apiClient.get(
      `/api/radius/users/export/excel?${params.toString()}`,
      { responseType: 'blob' }
    )
    return response.data
  },

  // Tag operations
  getUserTags: async (userId: number): Promise<RadiusTag[]> => {
    const response = await apiClient.get(`/api/radius/users/${userId}/tags`)
    return response.data
  },

  assignTags: async (userId: number, tagIds: number[]): Promise<void> => {
    await apiClient.post(`/api/radius/users/${userId}/tags`, tagIds)
  },

  // Change username
  changeUsername: async (id: number, newUsername: string): Promise<{ message: string; username: string }> => {
    const response = await apiClient.put(`/api/radius/users/${id}/username`, { newUsername })
    return response.data
  },

  changeUsernameByUuid: async (uuid: string, newUsername: string): Promise<{ message: string; username: string }> => {
    const response = await apiClient.put(`/api/radius/users/uuid/${uuid}/username`, { newUsername })
    return response.data
  },

  // Bulk operations
  bulkDelete: async (userIds: number[]): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post(`/api/radius/users/bulk-delete`, { userIds })
    return response.data
  },

  bulkRestore: async (userIds: number[]): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post(`/api/radius/users/bulk-restore`, { userIds })
    return response.data
  },

  bulkRenew: async (userIds: number[]): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post(`/api/radius/users/bulk-renew`, { userIds })
    return response.data
  },

  // Get user history
  getUserHistory: async (
    uuid: string,
    page: number = 1,
    pageSize: number = 50,
    eventType?: string
  ): Promise<{ data: any[]; totalCount: number; page: number; pageSize: number; totalPages: number }> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    if (eventType) {
      params.append('eventType', eventType)
    }
    const response = await apiClient.get(`/api/radius/users/uuid/${uuid}/history?${params.toString()}`)
    return response.data
  },
}
