import { apiClient } from '../lib/api'

export interface SasRadiusIntegration {
  id?: number
  name: string
  url: string
  username: string
  password: string
  useHttps: boolean
  isActive: boolean
  maxItemInPagePerRequest?: number
  action?: string
  description?: string
  instantId?: number
  createdAt?: string
  updatedAt?: string
}

export interface SyncProgress {
  syncId: string
  integrationId: number
  integrationName: string
  instantId: number
  status: number
  currentPhase: number
  profileCurrentPage: number
  profileTotalPages: number
  profileTotalRecords: number
  profileProcessedRecords: number
  profileNewRecords: number
  profileUpdatedRecords: number
  profileFailedRecords: number
  userCurrentPage: number
  userTotalPages: number
  userTotalRecords: number
  userProcessedRecords: number
  userNewRecords: number
  userUpdatedRecords: number
  userFailedRecords: number
  progressPercentage: number
  currentMessage?: string
  errorMessage?: string
  startedAt: string
  completedAt?: string
  lastUpdatedAt: string
}

export interface PaginatedSyncResponse {
  data: SyncProgress[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export const sasRadiusApi = {
  getAll: async (instantId: number): Promise<SasRadiusIntegration[]> => {
    const response = await apiClient.get(`/api/instants/${instantId}/sas-radius`)
    return response.data
  },

  getById: async (instantId: number, id: number): Promise<SasRadiusIntegration> => {
    const response = await apiClient.get(`/api/instants/${instantId}/sas-radius/${id}`)
    return response.data
  },

  create: async (instantId: number, data: SasRadiusIntegration): Promise<SasRadiusIntegration> => {
    const response = await apiClient.post(`/api/instants/${instantId}/sas-radius`, data)
    return response.data
  },

  update: async (instantId: number, id: number, data: SasRadiusIntegration): Promise<void> => {
    await apiClient.put(`/api/instants/${instantId}/sas-radius/${id}`, { ...data, id })
  },

  delete: async (instantId: number, id: number): Promise<void> => {
    await apiClient.delete(`/api/instants/${instantId}/sas-radius/${id}`)
  },

  sync: async (instantId: number, id: number, fullSync: boolean = false): Promise<{ syncId: string; message: string; integrationId: number; integrationName: string; instantId: number }> => {
    const response = await apiClient.post(`/api/instants/${instantId}/sas-radius/${id}/sync?fullSync=${fullSync}`)
    return response.data
  },

  getActiveSyncs: async (instantId: number): Promise<SyncProgress[]> => {
    const response = await apiClient.get(`/api/instants/${instantId}/sas-radius/syncs/active`)
    return response.data
  },

  getSyncProgress: async (instantId: number, syncId: string): Promise<SyncProgress> => {
    const response = await apiClient.get(`/api/instants/${instantId}/sas-radius/syncs/${syncId}`)
    return response.data
  },

  getAllSyncs: async (
    instantId: number, 
    page: number = 1,
    pageSize: number = 20,
    sortBy: string = 'startedAt',
    sortDirection: string = 'desc',
    status?: number
  ): Promise<PaginatedSyncResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      sortBy,
      sortDirection,
    })
    if (status !== undefined) {
      params.append('status', status.toString())
    }
    const response = await apiClient.get(`/api/instants/${instantId}/sas-radius/syncs?${params.toString()}`)
    return response.data
  },

  cancelSync: async (instantId: number, syncId: string): Promise<{ message: string; syncId: string }> => {
    const response = await apiClient.post(`/api/instants/${instantId}/sas-radius/syncs/${syncId}/cancel`)
    return response.data
  },
}
