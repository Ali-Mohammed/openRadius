import { apiClient } from '../lib/api'

export interface RadiusIpReservation {
  id: number
  ipAddress: string
  description?: string
  radiusUserId?: number
  username?: string
  firstname?: string
  lastname?: string
  profileName?: string
  zoneName?: string
  groupName?: string
  createdAt: string
  updatedAt?: string
  deletedAt?: string
  deletedBy?: string
}

export interface IpReservationPaginatedResponse {
  data: RadiusIpReservation[]
  pagination: {
    currentPage: number
    pageSize: number
    totalPages: number
    totalRecords: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export const radiusIpReservationApi = {
  getAll: async (params: {
    page?: number
    pageSize?: number
    search?: string
    sortField?: string
    sortDirection?: 'asc' | 'desc'
    onlyDeleted?: boolean
  } = {}): Promise<IpReservationPaginatedResponse> => {
    const queryParams = new URLSearchParams()
    if (params.page) queryParams.append('page', params.page.toString())
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString())
    if (params.search) queryParams.append('search', params.search)
    if (params.sortField) queryParams.append('sortField', params.sortField)
    if (params.sortDirection) queryParams.append('sortDirection', params.sortDirection)
    if (params.onlyDeleted) queryParams.append('onlyDeleted', 'true')

    const response = await apiClient.get(`/api/radius/ip-reservations?${queryParams.toString()}`)
    return response.data
  },

  getById: async (id: number): Promise<RadiusIpReservation> => {
    const response = await apiClient.get(`/api/radius/ip-reservations/${id}`)
    return response.data
  },

  create: async (data: Partial<RadiusIpReservation>): Promise<RadiusIpReservation> => {
    const response = await apiClient.post('/api/radius/ip-reservations', data)
    return response.data
  },

  update: async (id: number, data: Partial<RadiusIpReservation>): Promise<void> => {
    await apiClient.put(`/api/radius/ip-reservations/${id}`, { ...data, id })
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/radius/ip-reservations/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/radius/ip-reservations/${id}/restore`)
  },

  bulkDelete: async (ids: number[]): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post('/api/radius/ip-reservations/bulk-delete', ids)
    return response.data
  },

  bulkRestore: async (ids: number[]): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post('/api/radius/ip-reservations/bulk-restore', ids)
    return response.data
  },
}
