import { apiClient } from '../lib/api'
import type { Dashboard, DashboardItem } from '../types/dashboard'

export const dashboardApi = {
  // Get all dashboards
  getDashboards: async (): Promise<Dashboard[]> => {
    const response = await apiClient.get('/api/dashboard')
    return response.data
  },

  // Get single dashboard
  getDashboard: async (id: string): Promise<Dashboard> => {
    const response = await apiClient.get(`/api/dashboard/${id}`)
    return response.data
  },

  // Create dashboard
  createDashboard: async (dashboard: Partial<Dashboard>): Promise<Dashboard> => {
    const response = await apiClient.post('/api/dashboard', dashboard)
    return response.data
  },

  // Update dashboard
  updateDashboard: async (id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> => {
    const response = await apiClient.put(`/api/dashboard/${id}`, dashboard)
    return response.data
  },

  // Delete dashboard
  deleteDashboard: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/dashboard/${id}`)
  },

  // Add item to dashboard
  addItem: async (dashboardId: string, item: Partial<DashboardItem> & { tabId: number }): Promise<DashboardItem> => {
    const response = await apiClient.post(`/api/dashboard/${dashboardId}/items`, item)
    return response.data
  },

  // Update item layout
  updateItemLayout: async (dashboardId: string, itemId: string, layout: { x: number; y: number; w: number; h: number }): Promise<void> => {
    await apiClient.put(`/api/dashboard/${dashboardId}/items/${itemId}/layout`, layout)
  },

  // Delete item
  deleteItem: async (dashboardId: string, itemId: string): Promise<void> => {
    await apiClient.delete(`/api/dashboard/${dashboardId}/items/${itemId}`)
  },
}

