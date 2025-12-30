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
