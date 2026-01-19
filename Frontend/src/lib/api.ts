import axios from 'axios'
import { appConfig } from '../config/app.config'
import keycloak from '../keycloak'

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: appConfig.api.baseUrl,
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
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

  setWorkspace: async (workspaceId: number, setAsDefault: boolean = true) => {
    const { data } = await apiClient.post(`/api/users/me/workspace/${workspaceId}`, null, {
      params: { setAsDefault }
    })
    return data
  },
}

// Workspace API
export interface Workspace {
  id: number
  title: string
  name: string
  location: string
  description: string
  comments: string
  status: 'active' | 'inactive'
  color: string
  icon: string
  currency: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  deletedAt: string | null
  deletedBy: string | null
}

export interface WorkspaceCreateDto {
  title: string
  name: string
  location: string
  description: string
  comments: string
  status: 'active' | 'inactive'
  color: string
  icon: string
}

export const workspaceApi = {
  getAll: async (params?: { search?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
    const { data } = await apiClient.get<Workspace[]>('/api/workspace', { params })
    return data
  },

  getById: async (id: number) => {
    const { data } = await apiClient.get<Workspace>(`/api/workspace/${id}`)
    return data
  },

  create: async (workspace: WorkspaceCreateDto) => {
    const { data } = await apiClient.post<Workspace>('/api/workspace', workspace)
    return data
  },

  update: async (id: number, workspace: Partial<WorkspaceCreateDto>) => {
    await apiClient.put(`/api/workspace/${id}`, workspace)
  },

  delete: async (id: number) => {
    await apiClient.delete(`/api/workspace/${id}`)
  },

  restore: async (id: number) => {
    await apiClient.post(`/api/workspace/${id}/restore`)
  },

  getDeleted: async () => {
    const { data } = await apiClient.get<Workspace[]>('/api/workspace/deleted')
    return data
  },

  export: async () => {
    const response = await apiClient.get('/api/workspace/export', {
      responseType: 'blob'
    })
    return response.data
  },

  exportJson: async () => {
    const response = await apiClient.get('/api/workspace/export-json', {
      responseType: 'blob'
    })
    return response.data
  },

  importJson: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post<{ message: string; imported: number; skipped: number; errors: string[] }>(
      '/api/workspace/import-json',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return data
  },
}
