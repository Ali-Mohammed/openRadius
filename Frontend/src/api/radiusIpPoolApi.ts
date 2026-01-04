import { apiClient } from '../lib/api'

export interface RadiusIpPool {
  id?: number
  name: string
  startIp: string
  endIp: string
  leaseTime: number
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
  workspaceId?: number
}

export interface CreateRadiusIpPoolRequest {
  name: string
  startIp: string
  endIp: string
  leaseTime: number
}

export interface UpdateRadiusIpPoolRequest {
  name?: string
  startIp?: string
  endIp?: string
  leaseTime?: number
}

export interface PaginatedIpPoolResponse {
  data: RadiusIpPool[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export const radiusIpPoolApi = {
  getAll: async (
    workspaceId: number,
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc',
    includeDeleted: boolean = false
  ): Promise<PaginatedIpPoolResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      includeDeleted: includeDeleted.toString(),
    })
    
    if (search) params.append('search', search)
    if (sortField) params.append('sortField', sortField)
    if (sortDirection) params.append('sortDirection', sortDirection)

    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/ip-pools?${params}`)
    return response.data
  },

  getById: async (workspaceId: number, id: number): Promise<RadiusIpPool> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/ip-pools/${id}`)
    return response.data
  },

  create: async (workspaceId: number, data: CreateRadiusIpPoolRequest): Promise<RadiusIpPool> => {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/radius/ip-pools`, data)
    return response.data
  },

  update: async (workspaceId: number, id: number, data: UpdateRadiusIpPoolRequest): Promise<RadiusIpPool> => {
    const response = await apiClient.put(`/api/workspaces/${workspaceId}/radius/ip-pools/${id}`, data)
    return response.data
  },

  delete: async (workspaceId: number, id: number): Promise<void> => {
    await apiClient.delete(`/api/workspaces/${workspaceId}/radius/ip-pools/${id}`)
  },

  restore: async (workspaceId: number, id: number): Promise<void> => {
    await apiClient.post(`/api/workspaces/${workspaceId}/radius/ip-pools/${id}/restore`)
  },

  getTrash: async (
    workspaceId: number,
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedIpPoolResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/ip-pools/trash?${params}`)
    return response.data
  },
}
