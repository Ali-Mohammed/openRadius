import { apiClient } from '../lib/api'

export interface GeneralSettings {
  currency: string
  churnDays: number
  dateFormat: string
}

export interface SwaggerSetting {
  enabled: boolean
  updatedAt: string
  updatedByEmail: string | null
}

export const settingsApi = {
  getGeneralSettings: async (workspaceId: number): Promise<GeneralSettings> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/settings/general`)
    return response.data
  },

  updateGeneralSettings: async (workspaceId: number, settings: GeneralSettings): Promise<void> => {
    await apiClient.put(`/api/workspaces/${workspaceId}/settings/general`, settings)
  },

  // System Settings (global, not workspace-scoped)
  getSwaggerSetting: async (): Promise<SwaggerSetting> => {
    const response = await apiClient.get('/api/system-settings/swagger')
    return response.data
  },

  updateSwaggerSetting: async (enabled: boolean): Promise<void> => {
    await apiClient.put('/api/system-settings/swagger', { enabled })
  },
}
