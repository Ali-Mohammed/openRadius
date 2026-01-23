import { apiClient } from '../lib/api'

export interface SubAgentCashback {
  id: number
  supervisorId: number
  subAgentId: number
  subAgentEmail?: string
  subAgentName?: string
  subAgentUsername?: string
  billingProfileId: number
  billingProfileName?: string
  amount: number
  notes?: string
  createdAt: string
  updatedAt?: string
}

export interface SubAgent {
  id: number
  email: string
  firstName: string
  lastName: string
  username: string
  name: string
}

export interface CreateSubAgentCashbackRequest {
  subAgentId: number
  billingProfileId: number
  amount: number
  notes?: string
}

export interface BulkSubAgentCashbackRequest {
  subAgentId: number
  cashbacks: Array<{
    billingProfileId: number
    amount: number
  }>
}

export const subAgentCashbackApi = {
  // Get all sub-agent cashbacks for current supervisor
  getAll: async (): Promise<SubAgentCashback[]> => {
    const response = await apiClient.get('/SubAgentCashback')
    return response.data
  },

  // Get sub-agents for current supervisor
  getSubAgents: async (): Promise<SubAgent[]> => {
    const response = await apiClient.get('/SubAgentCashback/sub-agents')
    return response.data
  },

  // Get cashbacks for specific sub-agent
  getBySubAgent: async (subAgentId: number): Promise<SubAgentCashback[]> => {
    const response = await apiClient.get(`/SubAgentCashback/sub-agent/${subAgentId}`)
    return response.data
  },

  // Create or update sub-agent cashback
  createOrUpdate: async (data: CreateSubAgentCashbackRequest): Promise<SubAgentCashback> => {
    const response = await apiClient.post('/SubAgentCashback', data)
    return response.data
  },

  // Delete sub-agent cashback
  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/SubAgentCashback/${id}`)
  },

  // Bulk update cashbacks for a sub-agent
  bulkUpdate: async (data: BulkSubAgentCashbackRequest): Promise<{ created: number; updated: number }> => {
    const response = await apiClient.post('/SubAgentCashback/bulk', data)
    return response.data
  }
}
