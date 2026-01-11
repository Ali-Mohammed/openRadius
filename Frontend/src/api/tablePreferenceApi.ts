import { apiClient } from '../lib/api'

export interface TablePreference {
  id: number
  userId: string
  workspaceId: number
  tableName: string
  columnWidths?: string
  columnOrder?: string
  columnVisibility?: string
  sortField?: string
  sortDirection?: string
  createdAt: string
  updatedAt: string
}

export interface SaveTablePreferenceDto {
  workspaceId: number
  tableName: string
  columnWidths?: string
  columnOrder?: string
  columnVisibility?: string
  sortField?: string
  sortDirection?: string
}

export const tablePreferenceApi = {
  getPreference: async (tableName: string, workspaceId: number): Promise<TablePreference | null> => {
    try {
      const response = await apiClient.get(`/api/table-preferences/${tableName}?workspaceId=${workspaceId}`)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  savePreference: async (data: SaveTablePreferenceDto): Promise<TablePreference> => {
    const response = await apiClient.post('/api/table-preferences', data)
    return response.data
  },

  deletePreference: async (tableName: string, workspaceId: number): Promise<void> => {
    await apiClient.delete(`/api/table-preferences/${tableName}?workspaceId=${workspaceId}`)
  },
}
