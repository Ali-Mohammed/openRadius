import axios from 'axios'
import { appConfig } from '../config/app.config'
import keycloak from '../keycloak'

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: appConfig.api.baseUrl,
})

// Add auth interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (keycloak.token) {
      config.headers.Authorization = `Bearer ${keycloak.token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// API functions
export const usersApi = {
  getCurrentUser: async () => {
    const { data } = await apiClient.get('/api/users/me')
    return data
  },

  getAllUsers: async () => {
    const { data } = await apiClient.get('/api/users')
    return data
  },

  updateProfile: async (profileData: { firstName: string; lastName: string }) => {
    const { data } = await apiClient.put('/api/users/me', profileData)
    return data
  },
}

// Instant API
export interface Instant {
  id: number
  title: string
  name: string
  location: string
  description: string
  comments: string
  status: 'active' | 'inactive'
  color: string
  createdAt: string
  updatedAt: string
}

export interface InstantCreateDto {
  title: string
  name: string
  location: string
  description: string
  comments: string
  status: 'active' | 'inactive'
  color: string
}

export const instantApi = {
  getAll: async (params?: { search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const { data } = await apiClient.get<Instant[]>('/api/instant', { params })
    return data
  },

  getById: async (id: number) => {
    const { data } = await apiClient.get<Instant>(`/api/instant/${id}`)
    return data
  },

  create: async (instant: InstantCreateDto) => {
    const { data } = await apiClient.post<Instant>('/api/instant', instant)
    return data
  },

  update: async (id: number, instant: Partial<InstantCreateDto>) => {
    await apiClient.put(`/api/instant/${id}`, instant)
  },

  delete: async (id: number) => {
    await apiClient.delete(`/api/instant/${id}`)
  },

  export: async () => {
    const response = await apiClient.get('/api/instant/export', {
      responseType: 'blob'
    })
    return response.data
  },
}
