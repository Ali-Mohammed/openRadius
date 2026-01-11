import { apiClient } from '../lib/api'

export interface RadiusTag {
  id: number
  title: string
  description?: string
  status: string
  color: string
  createdAt?: string
  updatedAt?: string
}

export const radiusTagApi = {
  getAll: async (includeDeleted: boolean = false): Promise<RadiusTag[]> => {
    const params = new URLSearchParams()
    if (includeDeleted) {
      params.append('includeDeleted', 'true')
    }
    const response = await apiClient.get(`/api/radius/tags?${params.toString()}`)
    return response.data
  },

  getById: async (id: number): Promise<RadiusTag> => {
    const response = await apiClient.get(`/api/radius/tags/${id}`)
    return response.data
  },

  create: async (data: Partial<RadiusTag>): Promise<RadiusTag> => {
    const response = await apiClient.post('/api/radius/tags', data)
    return response.data
  },

  update: async (id: number, data: Partial<RadiusTag>): Promise<RadiusTag> => {
    const response = await apiClient.put(`/api/radius/tags/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/radius/tags/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/radius/tags/${id}/restore`)
  },
}
