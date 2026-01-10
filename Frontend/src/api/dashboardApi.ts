import api from '../lib/api'
import type { Dashboard } from '../types/dashboard'

export const dashboardApi = {
  // Get all dashboards
  getDashboards: async (): Promise<Dashboard[]> => {
    const response = await api.get('/api/dashboards')
    return response.data
  },

  // Get single dashboard
  getDashboard: async (id: string): Promise<Dashboard> => {
    const response = await api.get(`/api/dashboards/${id}`)
    return response.data
  },

  // Create dashboard
  createDashboard: async (dashboard: Partial<Dashboard>): Promise<Dashboard> => {
    const response = await api.post('/api/dashboards', dashboard)
    return response.data
  },

  // Update dashboard
  updateDashboard: async (id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> => {
    const response = await api.put(`/api/dashboards/${id}`, dashboard)
    return response.data
  },

  // Delete dashboard
  deleteDashboard: async (id: string): Promise<void> => {
    await api.delete(`/api/dashboards/${id}`)
  },
}
