import { apiClient } from '../lib/api'
import type { Dashboard, DashboardItem } from '../types/dashboard'

// Get current workspace ID from context or localStorage
const getWorkspaceId = () => {
  const workspace = localStorage.getItem('currentWorkspace')
  if (workspace) {
    try {
      const parsed = JSON.parse(workspace)
      return parsed.id || 1
    } catch {
      return 1
    }
  }
  return 1
}

export const dashboardApi = {
  // Get all dashboards
  getDashboards: async (): Promise<Dashboard[]> => {
    const workspaceId = getWorkspaceId()
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/dashboard`)
    return response.data
  },

  // Get single dashboard
  getDashboard: async (id: string): Promise<Dashboard> => {
    const workspaceId = getWorkspaceId()
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/dashboard/${id}`)
    return response.data
  },

  // Create dashboard
  createDashboard: async (dashboard: Partial<Dashboard>): Promise<Dashboard> => {
    const workspaceId = getWorkspaceId()
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/dashboard`, dashboard)
    return response.data
  },

  // Update dashboard
  updateDashboard: async (id: string, dashboard: Partial<Dashboard>): Promise<Dashboard> => {
    const workspaceId = getWorkspaceId()
    const response = await apiClient.put(`/api/workspaces/${workspaceId}/dashboard/${id}`, dashboard)
    return response.data
  },

  // Delete dashboard
  deleteDashboard: async (id: string): Promise<void> => {
    const workspaceId = getWorkspaceId()
    await apiClient.delete(`/api/workspaces/${workspaceId}/dashboard/${id}`)
  },

  // Add item to dashboard
  addItem: async (dashboardId: string, item: Partial<DashboardItem> & { tabId: number }): Promise<DashboardItem> => {
    const workspaceId = getWorkspaceId()
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/dashboard/${dashboardId}/items`, item)
    return response.data
  },

  // Update item layout
  updateItemLayout: async (dashboardId: string, itemId: string, layout: { x: number; y: number; w: number; h: number }): Promise<void> => {
    const workspaceId = getWorkspaceId()
    await apiClient.put(`/api/workspaces/${workspaceId}/dashboard/${dashboardId}/items/${itemId}/layout`, layout)
  },

  // Delete item
  deleteItem: async (dashboardId: string, itemId: string): Promise<void> => {
    const workspaceId = getWorkspaceId()
    await apiClient.delete(`/api/workspaces/${workspaceId}/dashboard/${dashboardId}/items/${itemId}`)
  },
}

