import { apiClient } from '../lib/api'

export interface RadiusNas {
  id?: number
  nasname: string
  shortname: string
  type: number
  secret: string
  apiUsername?: string
  apiPassword?: string
  coaPort: number
  version?: string
  description?: string
  server?: string
  enabled: number
  siteId?: number
  httpPort: number
  monitor: number
  pingTime: number
  pingLoss: number
  ipAccountingEnabled: number
  poolName?: string
  apiPort?: number
  snmpCommunity?: string
  sshUsername?: string
  sshPassword?: string
  sshPort: number
  createdBy?: number
  createdAt?: string
  updatedAt?: string
  isDeleted?: boolean
  deletedAt?: string
  workspaceId?: number
}

export interface CreateRadiusNasRequest {
  nasname: string
  shortname: string
  type: number
  secret: string
  apiUsername?: string
  apiPassword?: string
  coaPort?: number
  version?: string
  description?: string
  server?: string
  enabled?: number
  siteId?: number
  httpPort?: number
  monitor?: number
  ipAccountingEnabled?: number
  poolName?: string
  apiPort?: number
  snmpCommunity?: string
  sshUsername?: string
  sshPassword?: string
  sshPort?: number
}

export interface UpdateRadiusNasRequest {
  nasname?: string
  shortname?: string
  type?: number
  secret?: string
  apiUsername?: string
  apiPassword?: string
  coaPort?: number
  version?: string
  description?: string
  server?: string
  enabled?: number
  siteId?: number
  httpPort?: number
  monitor?: number
  ipAccountingEnabled?: number
  poolName?: string
  apiPort?: number
  snmpCommunity?: string
  sshUsername?: string
  sshPassword?: string
  sshPort?: number
}

export interface PaginatedNasResponse {
  data: RadiusNas[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export interface NasStats {
  total: number
  enabled: number
  monitored: number
  deleted: number
}

export const radiusNasApi = {
  getAll: async (
    workspaceId: number,
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc',
    includeDeleted: boolean = false
  ): Promise<PaginatedNasResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      includeDeleted: includeDeleted.toString(),
    })
    
    if (search) params.append('search', search)
    if (sortField) params.append('sortField', sortField)
    if (sortDirection) params.append('sortDirection', sortDirection)

    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/nas?${params}`)
    return response.data
  },

  getById: async (workspaceId: number, id: number): Promise<RadiusNas> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/nas/${id}`)
    return response.data
  },

  create: async (workspaceId: number, data: CreateRadiusNasRequest): Promise<RadiusNas> => {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/radius/nas`, data)
    return response.data
  },

  update: async (workspaceId: number, id: number, data: UpdateRadiusNasRequest): Promise<RadiusNas> => {
    const response = await apiClient.put(`/api/workspaces/${workspaceId}/radius/nas/${id}`, data)
    return response.data
  },

  delete: async (workspaceId: number, id: number): Promise<void> => {
    await apiClient.delete(`/api/workspaces/${workspaceId}/radius/nas/${id}`)
  },

  restore: async (workspaceId: number, id: number): Promise<void> => {
    await apiClient.post(`/api/workspaces/${workspaceId}/radius/nas/${id}/restore`)
  },

  getTrash: async (
    workspaceId: number,
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedNasResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/nas/trash?${params}`)
    return response.data
  },

  getStats: async (workspaceId: number): Promise<NasStats> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/nas/stats`)
    return response.data
  },
}
