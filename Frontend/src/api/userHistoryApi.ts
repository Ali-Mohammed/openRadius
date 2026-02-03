import { apiClient } from '@/lib/api'

export interface UserHistoryEvent {
  id: number
  eventType: 'activation' | 'profile_change' | 'password_change' | 'info_update' | 'wallet_transaction' | 'status_change' | 'creation' | 'deletion' | 'custom_attribute'
  timestamp: string
  performedBy: string
  performedFor: string
  isOnBehalf: boolean
  description: string
  details: any
  metadata?: {
    ipAddress?: string
    userAgent?: string
  }
}

export interface UserHistoryResponse {
  data: UserHistoryEvent[]
  totalCount: number
  page: number
  pageSize: number
}

export const userHistoryApi = {
  // Get comprehensive user history
  getUserHistory: async (
    userId: number,
    page = 1,
    pageSize = 50,
    eventType?: string
  ): Promise<UserHistoryResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    
    if (eventType) {
      params.append('eventType', eventType)
    }

    const response = await apiClient.get(`/api/radius-users/${userId}/history?${params}`)
    return response.data
  },
}
