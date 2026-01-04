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
  getAll: async (workspaceId: number, includeDeleted: boolean = false): Promise<RadiusTag[]> => {
    const params = new URLSearchParams()
    if (includeDeleted) {
      params.append('includeDeleted', 'true')
    }
    const response = await apiClient.get(`/api/workspace/${workspaceId}/radius/tags?${params.toString()}`)
    return response.data
  },
}
