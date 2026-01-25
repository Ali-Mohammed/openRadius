import { apiClient } from '../lib/api'

export interface IntegrationWebhook {
  id?: number
  workspaceId: number
  integrationName: string
  integrationType: string
  callbackEnabled: boolean
  webhookToken: string
  webhookUrl: string
  requireAuthentication: boolean
  allowedIpAddresses?: string
  isActive: boolean
  description?: string
  createdAt?: string
  updatedAt?: string
  lastUsedAt?: string
  requestCount: number
  isDeleted: boolean
}

export interface CreateWebhookRequest {
  integrationName: string
  integrationType: string
  callbackEnabled: boolean
  requireAuthentication: boolean
  allowedIpAddresses?: string
  description?: string
}

export interface UpdateWebhookRequest {
  integrationName: string
  integrationType: string
  callbackEnabled: boolean
  requireAuthentication: boolean
  allowedIpAddresses?: string
  description?: string
  isActive: boolean
}

export interface WebhookLog {
  id: number
  webhookId: number
  workspaceId: number
  method: string
  ipAddress?: string
  headers?: string
  requestBody?: string
  statusCode: number
  responseBody?: string
  errorMessage?: string
  success: boolean
  processingTimeMs: number
  createdAt: string
}

export interface WebhookLogsResponse {
  logs: WebhookLog[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export const integrationWebhookApi = {
  getAll: async (workspaceId: number) => {
    const response = await apiClient.get<IntegrationWebhook[]>(`/api/workspaces/${workspaceId}/IntegrationWebhooks`)
    return response.data
  },

  getById: async (workspaceId: number, id: number) => {
    const response = await apiClient.get<IntegrationWebhook>(`/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}`)
    return response.data
  },

  create: async (workspaceId: number, data: CreateWebhookRequest) => {
    const response = await apiClient.post<IntegrationWebhook>(`/api/workspaces/${workspaceId}/IntegrationWebhooks`, data)
    return response.data
  },

  update: async (workspaceId: number, id: number, data: UpdateWebhookRequest) => {
    const response = await apiClient.put<IntegrationWebhook>(`/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}`, data)
    return response.data
  },

  delete: async (workspaceId: number, id: number) => {
    const response = await apiClient.delete(`/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}`)
    return response.data
  },

  regenerateToken: async (workspaceId: number, id: number) => {
    const response = await apiClient.post<IntegrationWebhook>(`/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}/regenerate-token`)
    return response.data
  },

  getLogs: async (workspaceId: number, id: number, page = 1, pageSize = 50) => {
    const response = await apiClient.get<WebhookLogsResponse>(
      `/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}/logs?page=${page}&pageSize=${pageSize}`
    )
    return response.data
  },
}
