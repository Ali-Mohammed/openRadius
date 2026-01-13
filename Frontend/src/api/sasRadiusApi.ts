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
  workspaceId?: number
  createdAt?: string
  updatedAt?: string
  latestSyncStatus?: number
  latestSyncDate?: string
}

export interface SyncProgress {
  syncId: string
  integrationId: number
  integrationName: string
  workspaceId: number
  status: number
  currentPhase: number
  profileCurrentPage: number
  profileTotalPages: number
  profileTotalRecords: number
  profileProcessedRecords: number
  profileNewRecords: number
  profileUpdatedRecords: number
  profileFailedRecords: number
  zoneTotalRecords: number
  zoneProcessedRecords: number
  zoneNewRecords: number
  zoneUpdatedRecords: number
  zoneFailedRecords: number
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
  getAll: async (workspaceId: number): Promise<SasRadiusIntegration[]> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/sas-radius`)
    return response.data
  },

  getById: async (workspaceId: number, id: number): Promise<SasRadiusIntegration> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/sas-radius/${id}`)
    return response.data
  },

  create: async (workspaceId: number, data: SasRadiusIntegration): Promise<SasRadiusIntegration> => {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/sas-radius`, data)
    return response.data
  },

  update: async (workspaceId: number, id: number, data: SasRadiusIntegration): Promise<void> => {
    await apiClient.put(`/api/workspaces/${workspaceId}/sas-radius/${id}`, { ...data, id })
  },

  delete: async (workspaceId: number, id: number): Promise<void> => {
    await apiClient.delete(`/api/workspaces/${workspaceId}/sas-radius/${id}`)
  },

  restore: async (workspaceId: number, id: number): Promise<void> => {
    await apiClient.post(`/api/workspaces/${workspaceId}/sas-radius/${id}/restore`)
  },

  getTrash: async (workspaceId: number): Promise<SasRadiusIntegration[]> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/sas-radius/trash`)
    return response.data
  },

  sync: async (workspaceId: number, id: number, fullSync: boolean = false): Promise<{ syncId: string; message: string; integrationId: number; integrationName: string; workspaceId: number }> => {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/sas-radius/${id}/sync?fullSync=${fullSync}`)
    return response.data
  },

  getActiveSyncs: async (workspaceId: number): Promise<SyncProgress[]> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/sas-radius/syncs/active`)
    return response.data
  },

  getSyncProgress: async (workspaceId: number, syncId: string): Promise<SyncProgress> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/sas-radius/syncs/${syncId}`)
    return response.data
  },

  getAllSyncs: async (
    workspaceId: number, 
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
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/sas-radius/syncs?${params.toString()}`)
    return response.data
  },

  cancelSync: async (workspaceId: number, syncId: string): Promise<{ message: string; syncId: string }> => {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/sas-radius/syncs/${syncId}/cancel`)
    return response.data
  },
}

