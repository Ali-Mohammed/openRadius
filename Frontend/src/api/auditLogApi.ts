import { apiClient } from '../lib/api'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuditUser {
  uuid: string
  email?: string
  fullName?: string
}

export interface AuditLogEntry {
  uuid: string
  action: string
  entityType: string
  entityUuid?: string
  category: string
  previousData?: string
  newData?: string
  changes?: string
  description?: string
  reason?: string
  ipAddress?: string
  userAgent?: string
  requestPath?: string
  correlationId?: string
  metadata?: string
  status: string
  errorMessage?: string
  performedBy?: AuditUser
  targetUser?: AuditUser
  createdAt: string
}

export interface AuditLogFilters {
  search?: string
  action?: string
  entityType?: string
  entityUuid?: string
  category?: string
  status?: string
  performedByUuid?: string
  targetUserUuid?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
}

export interface AuditLogPagedResponse {
  data: AuditLogEntry[]
  currentPage: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface AuditLogStats {
  totalEntries: number
  todayEntries: number
  failedEntries: number
  byCategory: { category: string; count: number }[]
  byAction: { action: string; count: number }[]
}

// ── API ─────────────────────────────────────────────────────────────────────

const auditLogApi = {
  /**
   * Get paginated, filtered audit logs.
   */
  getAll: async (filters?: AuditLogFilters): Promise<AuditLogPagedResponse> => {
    const params = new URLSearchParams()
    if (filters?.search) params.append('search', filters.search)
    if (filters?.action) params.append('action', filters.action)
    if (filters?.entityType) params.append('entityType', filters.entityType)
    if (filters?.entityUuid) params.append('entityUuid', filters.entityUuid)
    if (filters?.category) params.append('category', filters.category)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.performedByUuid) params.append('performedByUuid', filters.performedByUuid)
    if (filters?.targetUserUuid) params.append('targetUserUuid', filters.targetUserUuid)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)
    if (filters?.page) params.append('page', filters.page.toString())
    if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString())
    if (filters?.sortField) params.append('sortField', filters.sortField)
    if (filters?.sortDirection) params.append('sortDirection', filters.sortDirection)

    const response = await apiClient.get(`/api/audit-logs?${params}`)
    return response.data
  },

  /**
   * Get a single audit log entry by UUID.
   */
  getByUuid: async (uuid: string): Promise<AuditLogEntry> => {
    const response = await apiClient.get(`/api/audit-logs/${uuid}`)
    return response.data
  },

  /**
   * Get audit log statistics.
   */
  getStats: async (filters?: { category?: string; startDate?: string; endDate?: string }): Promise<AuditLogStats> => {
    const params = new URLSearchParams()
    if (filters?.category) params.append('category', filters.category)
    if (filters?.startDate) params.append('startDate', filters.startDate)
    if (filters?.endDate) params.append('endDate', filters.endDate)

    const response = await apiClient.get(`/api/audit-logs/stats?${params}`)
    return response.data
  },

  /**
   * Get all distinct categories.
   */
  getCategories: async (): Promise<string[]> => {
    const response = await apiClient.get('/api/audit-logs/categories')
    return response.data
  },

  /**
   * Get all distinct actions.
   */
  getActions: async (): Promise<string[]> => {
    const response = await apiClient.get('/api/audit-logs/actions')
    return response.data
  },

  /**
   * Get all distinct entity types.
   */
  getEntityTypes: async (): Promise<string[]> => {
    const response = await apiClient.get('/api/audit-logs/entity-types')
    return response.data
  },

  /**
   * Get audit trail for a specific entity.
   */
  getByEntity: async (entityUuid: string, page = 1, pageSize = 50): Promise<AuditLogPagedResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/audit-logs/entity/${entityUuid}?${params}`)
    return response.data
  },

  /**
   * Get all actions performed by a specific user.
   */
  getByUser: async (userUuid: string, page = 1, pageSize = 50): Promise<AuditLogPagedResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/audit-logs/user/${userUuid}?${params}`)
    return response.data
  },
}

export default auditLogApi
