import { apiClient } from '../lib/api'

export interface RadiusGroup {
  id?: number
  name: string
  subscription?: string
  isActive: boolean
  color?: string
  icon?: string
  usersCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface PaginatedGroupsResponse {
  data: RadiusGroup[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export const radiusGroupApi = {
  getAll: async (
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<PaginatedGroupsResponse> => {
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
    const response = await apiClient.get(`/api/radius/groups?${params.toString()}`)
    return response.data
  },

  getById: async (id: number): Promise<RadiusGroup> => {
    const response = await apiClient.get(`/api/radius/groups/${id}`)
    return response.data
  },

  create: async (data: RadiusGroup): Promise<RadiusGroup> => {
    const response = await apiClient.post(`/api/radius/groups`, data)
    return response.data
  },

  update: async (id: number, data: Partial<RadiusGroup>): Promise<RadiusGroup> => {
    const response = await apiClient.put(`/api/radius/groups/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/radius/groups/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/radius/groups/${id}/restore`)
  },

  getTrash: async (
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedGroupsResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/radius/groups/trash?${params.toString()}`)
    return response.data
  },
}
