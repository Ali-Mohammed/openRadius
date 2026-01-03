import { apiClient } from '../lib/api'

export interface GeneralSettings {
  currency: string
}

export const settingsApi = {
  getGeneralSettings: async (workspaceId: number): Promise<GeneralSettings> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/settings/general`)
    return response.data
  },

  updateGeneralSettings: async (workspaceId: number, settings: GeneralSettings): Promise<void> => {
    await apiClient.put(`/api/workspaces/${workspaceId}/settings/general`, settings)
  },
}
