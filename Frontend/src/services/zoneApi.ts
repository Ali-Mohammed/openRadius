import { apiClient } from '@/lib/api'

export interface Zone {
  id: number
  name: string
  description?: string
  color?: string
  icon?: string
  workspaceId: number
  parentZoneId?: number
  parentZoneName?: string
  children: Zone[]
  createdAt: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  deletedAt?: string
  deletedBy?: string
  userCount: number
  radiusUserCount: number
  users?: Array<{ id: string; name: string; email: string }>
}

export interface ZoneCreateDto {
  name: string
  description?: string
  color?: string
  icon?: string
  parentZoneId?: number
}

export interface ZoneUpdateDto {
  name?: string
  description?: string
  color?: string
  icon?: string
  parentZoneId?: number
}

export interface AssignUsersToZoneDto {
  UserIds: number[]
}

export interface AssignRadiusUsersToZoneDto {
  RadiusUserIds: number[]
}

export const zoneApi = {
  // Get all zones (hierarchical)
  getZones: async (): Promise<Zone[]> => {
    const response = await apiClient.get(`/api/zone`)
    return response.data
  },

  // Get all zones as flat list (for dropdowns/selections)
  getZonesFlat: async (): Promise<Zone[]> => {
    const response = await apiClient.get(`/api/zone/flat`)
    return response.data
  },

  // Get single zone
  getZone: async (zoneId: number): Promise<Zone> => {
    const response = await apiClient.get(`/api/zone/${zoneId}`)
    return response.data
  },

  // Create zone
  createZone: async (data: ZoneCreateDto): Promise<Zone> => {
    const response = await apiClient.post(`/api/zone`, data)
    return response.data
  },

  // Update zone
  updateZone: async (zoneId: number, data: ZoneUpdateDto): Promise<Zone> => {
    const response = await apiClient.put(`/api/zone/${zoneId}`, data)
    return response.data
  },

  // Delete zone
  deleteZone: async (zoneId: number): Promise<void> => {
    await apiClient.delete(`/api/zone/${zoneId}`)
  },

  // Get deleted zones
  getDeletedZones: async (): Promise<Zone[]> => {
    const response = await apiClient.get(`/api/zone/deleted`)
    return response.data
  },

  // Restore zone
  restoreZone: async (zoneId: number): Promise<void> => {
    await apiClient.post(`/api/zone/${zoneId}/restore`)
  },

  // Assign users to zone
  assignUsersToZone: async (
    zoneId: number,
    data: AssignUsersToZoneDto
  ): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post(
      `/api/zone/${zoneId}/assign-users`,
      data
    )
    return response.data
  },

  // Get zone users
  getZoneUsers: async (zoneId: number): Promise<number[]> => {
    const response = await apiClient.get(`/api/zone/${zoneId}/users`)
    return response.data
  },

  // Assign radius users to zone
  assignRadiusUsersToZone: async (
    zoneId: number,
    data: AssignRadiusUsersToZoneDto
  ): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post(
      `/api/zone/${zoneId}/assign-radius-users`,
      data
    )
    return response.data
  },

  // Get zone radius users
  getZoneRadiusUsers: async (
    zoneId: number
  ): Promise<Array<{
    id: number
    username: string
    firstname: string
    lastname: string
    email: string
    phone: string
  }>> => {
    const response = await apiClient.get(`/api/zone/${zoneId}/radius-users`)
    return response.data
  },
}
