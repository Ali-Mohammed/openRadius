import { apiClient } from '../lib/api'

export interface RadiusActivation {
  id: number
  actionById?: number
  actionByUsername?: string
  actionForId?: number
  actionForUsername?: string
  isActionBehalf: boolean
  radiusUserId: number
  radiusUsername?: string
  previousRadiusProfileId?: number
  previousRadiusProfileName?: string
  radiusProfileId?: number
  radiusProfileName?: string
  previousBillingProfileId?: number
  previousBillingProfileName?: string
  billingProfileId?: number
  billingProfileName?: string
  previousExpireDate?: string
  currentExpireDate?: string
  nextExpireDate?: string
  previousBalance?: number
  newBalance?: number
  amount?: number
  type: string
  status: string
  apiStatus?: string
  apiStatusCode?: number
  apiStatusMessage?: string
  externalReferenceId?: string
  transactionId?: number
  paymentMethod?: string
  durationDays?: number
  source?: string
  ipAddress?: string
  notes?: string
  retryCount: number
  processingStartedAt?: string
  processingCompletedAt?: string
  createdAt: string
  updatedAt?: string
}

export interface RadiusActivationResponse {
  data: RadiusActivation[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface CreateRadiusActivationRequest {
  radiusUserId: number
  radiusProfileId?: number
  billingProfileId?: number
  nextExpireDate?: string
  amount?: number
  type: string
  paymentMethod?: string
  durationDays?: number
  source?: string
  notes?: string
  isActionBehalf?: boolean
  actionForId?: number
  actionForUsername?: string
  // For on-behalf activations: whose wallet to deduct from
  payerUserId?: number
  payerUsername?: string
  // Whether to apply cashback to payer's wallet
  applyCashback?: boolean
}

export interface UpdateActivationStatusRequest {
  status: string
  apiStatus?: string
  apiStatusCode?: number
  apiStatusMessage?: string
  apiResponse?: string
  externalReferenceId?: string
  newBalance?: number
  currentExpireDate?: string
}

export interface ActivationType {
  value: string
  label: string
}

export interface ActivationStatus {
  value: string
  label: string
}

export interface ActivationStats {
  totalActivations: number
  byStatus: { status: string; count: number }[]
  byType: { type: string; count: number }[]
  byApiStatus: { apiStatus: string; count: number }[]
  totalAmount: number
  successRate: number
}

export const radiusActivationApi = {
  getAll: async (params?: {
    page?: number
    pageSize?: number
    search?: string
    type?: string
    status?: string
    apiStatus?: string
    radiusUserId?: number
    radiusProfileId?: number
    billingProfileId?: number
    startDate?: string
    endDate?: string
    sortField?: string
    sortDirection?: 'asc' | 'desc'
    includeDeleted?: boolean
  }): Promise<RadiusActivationResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.type) queryParams.append('type', params.type)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.apiStatus) queryParams.append('apiStatus', params.apiStatus)
    if (params?.radiusUserId) queryParams.append('radiusUserId', params.radiusUserId.toString())
    if (params?.radiusProfileId) queryParams.append('radiusProfileId', params.radiusProfileId.toString())
    if (params?.billingProfileId) queryParams.append('billingProfileId', params.billingProfileId.toString())
    if (params?.startDate) queryParams.append('startDate', params.startDate)
    if (params?.endDate) queryParams.append('endDate', params.endDate)
    if (params?.sortField) queryParams.append('sortField', params.sortField)
    if (params?.sortDirection) queryParams.append('sortDirection', params.sortDirection)
    if (params?.includeDeleted) queryParams.append('includeDeleted', params.includeDeleted.toString())

    const response = await apiClient.get<RadiusActivationResponse>(
      `/api/RadiusActivation?${queryParams.toString()}`
    )
    return response.data
  },

  getById: async (id: number): Promise<RadiusActivation> => {
    const response = await apiClient.get<RadiusActivation>(`/api/RadiusActivation/${id}`)
    return response.data
  },

  getUserActivations: async (radiusUserId: number, limit?: number): Promise<RadiusActivation[]> => {
    const queryParams = limit ? `?limit=${limit}` : ''
    const response = await apiClient.get<RadiusActivation[]>(
      `/api/RadiusActivation/user/${radiusUserId}${queryParams}`
    )
    return response.data
  },

  create: async (request: CreateRadiusActivationRequest): Promise<RadiusActivation> => {
    const response = await apiClient.post<RadiusActivation>('/api/RadiusActivation', request)
    return response.data
  },

  updateStatus: async (id: number, request: UpdateActivationStatusRequest): Promise<void> => {
    await apiClient.put(`/api/RadiusActivation/${id}/status`, request)
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/RadiusActivation/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/RadiusActivation/${id}/restore`)
  },

  getTrash: async (page: number = 1, pageSize: number = 20): Promise<RadiusActivationResponse> => {
    const response = await apiClient.get<RadiusActivationResponse>(
      `/api/RadiusActivation/trash?page=${page}&pageSize=${pageSize}`
    )
    return response.data
  },

  getTypes: async (): Promise<ActivationType[]> => {
    const response = await apiClient.get<ActivationType[]>('/api/RadiusActivation/types')
    return response.data
  },

  getStatuses: async (): Promise<ActivationStatus[]> => {
    const response = await apiClient.get<ActivationStatus[]>('/api/RadiusActivation/statuses')
    return response.data
  },

  getApiStatuses: async (): Promise<ActivationStatus[]> => {
    const response = await apiClient.get<ActivationStatus[]>('/api/RadiusActivation/api-statuses')
    return response.data
  },

  getStats: async (startDate?: string, endDate?: string): Promise<ActivationStats> => {
    const queryParams = new URLSearchParams()
    if (startDate) queryParams.append('startDate', startDate)
    if (endDate) queryParams.append('endDate', endDate)

    const response = await apiClient.get<ActivationStats>(
      `/api/RadiusActivation/stats?${queryParams.toString()}`
    )
    return response.data
  }
}
