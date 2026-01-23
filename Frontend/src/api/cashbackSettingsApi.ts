import { apiClient } from '@/lib/api'

export interface CashbackSettings {
  id: number
  transactionType: string // "Instant" or "Collected"
  collectionSchedule?: string // "AnyTime", "EndOfWeek", "EndOfMonth"
  minimumCollectionAmount: number
  requiresApprovalToCollect: boolean
  createdAt?: string
  updatedAt?: string
}

export const cashbackSettingsApi = {
  getSettings: async (): Promise<CashbackSettings> => {
    const response = await apiClient.get('/api/CashbackSettings')
    return response.data
  },

  updateSettings: async (settings: Partial<CashbackSettings>): Promise<CashbackSettings> => {
    const response = await apiClient.post('/api/CashbackSettings', settings)
    return response.data
  }
}
