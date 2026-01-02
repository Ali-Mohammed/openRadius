import { apiClient } from '../lib/api'

export interface SasRadiusIntegration {
  id?: number
  name: string
  url: string
  username: string
  password: string
  useHttps: boolean
  isActive: boolean
  maxPagesPerRequest?: number
  action?: string
  description?: string
  instantId?: number
  createdAt?: string
  updatedAt?: string
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
}
