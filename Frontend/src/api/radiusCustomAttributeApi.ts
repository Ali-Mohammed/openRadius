import { apiClient } from '@/lib/api'

export interface RadiusCustomAttribute {
  id: number
  attributeName: string
  attributeValue: string
  attributeType: number
  operator: string
  linkType: 'user' | 'profile'
  radiusUserId?: number
  radiusUsername?: string
  radiusProfileId?: number
  radiusProfileName?: string
  priority: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateRadiusCustomAttributeRequest {
  attributeName: string
  attributeValue: string
  attributeType?: number
  operator?: string
  linkType: 'user' | 'profile'
  radiusUserId?: number
  radiusProfileId?: number
  priority?: number
  enabled?: boolean
}

export interface UpdateRadiusCustomAttributeRequest {
  attributeName?: string
  attributeValue?: string
  attributeType?: number
  operator?: string
  linkType?: 'user' | 'profile'
  radiusUserId?: number
  radiusProfileId?: number
  priority?: number
  enabled?: boolean
}

export interface RadiusCustomAttributeListResponse {
  data: RadiusCustomAttribute[]
  pagination: {
    currentPage: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
}

export const radiusCustomAttributeApi = {
  getAll: async (params?: {
    page?: number
    pageSize?: number
    search?: string
    linkType?: 'user' | 'profile'
    radiusUserId?: number
    radiusProfileId?: number
    sortField?: string
    sortDirection?: 'asc' | 'desc'
    includeDeleted?: boolean
  }): Promise<RadiusCustomAttributeListResponse> => {
    const response = await apiClient.get('/api/radius/custom-attributes', { params })
    return response.data
  },

  getById: async (id: number): Promise<RadiusCustomAttribute> => {
    const response = await apiClient.get(`/api/radius/custom-attributes/${id}`)
    return response.data
  },

  create: async (data: CreateRadiusCustomAttributeRequest): Promise<RadiusCustomAttribute> => {
    const response = await apiClient.post('/api/radius/custom-attributes', data)
    return response.data
  },

  update: async (id: number, data: UpdateRadiusCustomAttributeRequest): Promise<RadiusCustomAttribute> => {
    const response = await apiClient.put(`/api/radius/custom-attributes/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/radius/custom-attributes/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/radius/custom-attributes/${id}/restore`)
  },

  bulkDelete: async (ids: number[]): Promise<void> => {
    await apiClient.delete('/api/radius/custom-attributes/bulk', { data: ids })
  },
}
