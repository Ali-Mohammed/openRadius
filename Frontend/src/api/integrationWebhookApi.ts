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
  getAll: (workspaceId: number) =>
    apiClient.get<IntegrationWebhook[]>(`/api/workspaces/${workspaceId}/IntegrationWebhooks`),

  getById: (workspaceId: number, id: number) =>
    apiClient.get<IntegrationWebhook>(`/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}`),

  create: (workspaceId: number, data: CreateWebhookRequest) =>
    apiClient.post<IntegrationWebhook>(`/api/workspaces/${workspaceId}/IntegrationWebhooks`, data),

  update: (workspaceId: number, id: number, data: UpdateWebhookRequest) =>
    apiClient.put<IntegrationWebhook>(`/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}`, data),

  delete: (workspaceId: number, id: number) =>
    apiClient.delete(`/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}`),

  regenerateToken: (workspaceId: number, id: number) =>
    apiClient.post<IntegrationWebhook>(`/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}/regenerate-token`),

  getLogs: (workspaceId: number, id: number, page = 1, pageSize = 50) =>
    apiClient.get<WebhookLogsResponse>(
      `/api/workspaces/${workspaceId}/IntegrationWebhooks/${id}/logs?page=${page}&pageSize=${pageSize}`
    ),
}
