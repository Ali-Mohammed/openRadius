import axios from 'axios'
import { appConfig } from '../config/app.config'
import keycloak from '../keycloak'

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: appConfig.api.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
})

// --- Global 429 Rate Limit Handler ---
type RateLimitListener = (retryAfter: string) => void
let _rateLimitListener: RateLimitListener | null = null

/** Register a callback that fires when any 429 response is received */
export function onRateLimited(listener: RateLimitListener) {
  _rateLimitListener = listener
  return () => { _rateLimitListener = null }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfter || '60 seconds'
      _rateLimitListener?.(retryAfter)
    }
    return Promise.reject(error)
  }
)

// Add auth interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Check if user is impersonating - use impersonated token
    const impersonationData = sessionStorage.getItem('impersonation')
    if (impersonationData) {
      try {
        const parsed = JSON.parse(impersonationData)
        // Add impersonated user ID header so backend knows to return impersonated user data
        if (parsed.impersonatedUser?.id) {
          config.headers['X-Impersonated-User-Id'] = parsed.impersonatedUser.id.toString()
        }
        if (parsed.impersonatedToken) {
          config.headers.Authorization = `Bearer ${parsed.impersonatedToken}`
          return config
        }
      } catch (error) {
        console.error('Failed to parse impersonation data:', error)
      }
    }

    // Otherwise use the normal keycloak token
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

  impersonateUser: async (userId: number) => {
    const { data } = await apiClient.post(`/api/users/impersonate/${userId}`)
    return data
  },

  exitImpersonation: async () => {
    const { data } = await apiClient.post('/api/users/exit-impersonation')
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
