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

    const response = await apiClient.get(`/api/radius/ip-pools?${params}`)
    return response.data
  },

  getById: async (id: number): Promise<RadiusIpPool> => {
    const response = await apiClient.get(`/api/radius/ip-pools/${id}`)
    return response.data
  },

  create: async (data: CreateRadiusIpPoolRequest): Promise<RadiusIpPool> => {
    const response = await apiClient.post(`/api/radius/ip-pools`, data)
    return response.data
  },

  update: async (id: number, data: UpdateRadiusIpPoolRequest): Promise<RadiusIpPool> => {
    const response = await apiClient.put(`/api/radius/ip-pools/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/radius/ip-pools/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/radius/ip-pools/${id}/restore`)
  },

  getTrash: async (
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedIpPoolResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/radius/ip-pools/trash?${params}`)
    return response.data
  },
}
