import { apiClient } from '../lib/api'

// ── Types ───────────────────────────────────────────────────────────

export interface ApiKeyDto {
  uuid: string
  name: string
  keyPrefix: string
  scopes: string[]
  expiresAt: string | null
  lastUsedAt: string | null
  lastUsedIp: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiKeyCreatedDto {
  uuid: string
  name: string
  keyPrefix: string
  key: string // Only returned once at creation
  scopes: string[]
  expiresAt: string | null
  isActive: boolean
  createdAt: string
}

export interface CreateApiKeyRequest {
  name: string
  scopes?: string[]
  expiresAt?: string | null
}

export interface UpdateApiKeyRequest {
  name?: string
  scopes?: string[]
  expiresAt?: string | null
  isActive?: boolean
}

export interface ApiKeyPagedResponse {
  data: ApiKeyDto[]
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface ApiKeyScopeInfo {
  key: string
  label: string
  description: string
}

// ── API Client ──────────────────────────────────────────────────────

export const apiKeysApi = {
  list: async (page = 1, pageSize = 25, search?: string): Promise<ApiKeyPagedResponse> => {
    const params: Record<string, string | number> = { page, pageSize }
    if (search) params.search = search
    const response = await apiClient.get('/api/api-keys', { params })
    return response.data
  },

  getByUuid: async (uuid: string): Promise<ApiKeyDto> => {
    const response = await apiClient.get(`/api/api-keys/${uuid}`)
    return response.data
  },

  create: async (request: CreateApiKeyRequest): Promise<ApiKeyCreatedDto> => {
    const response = await apiClient.post('/api/api-keys', request)
    return response.data
  },

  update: async (uuid: string, request: UpdateApiKeyRequest): Promise<ApiKeyDto> => {
    const response = await apiClient.put(`/api/api-keys/${uuid}`, request)
    return response.data
  },

  delete: async (uuid: string): Promise<void> => {
    await apiClient.delete(`/api/api-keys/${uuid}`)
  },

  getScopes: async (): Promise<ApiKeyScopeInfo[]> => {
    const response = await apiClient.get('/api/api-keys/scopes')
    return response.data
  },
}
