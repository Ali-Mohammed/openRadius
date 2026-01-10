import { apiClient } from '@/lib/api'

export interface Zone {
  id: number
  name: string
  description?: string
  color?: string
  workspaceId: number
  createdAt: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  userCount: number
  radiusUserCount: number
}

export interface ZoneCreateDto {
  name: string
  description?: string
  color?: string
}

export interface ZoneUpdateDto {
  name?: string
  description?: string
  color?: string
}

export interface AssignUsersToZoneDto {
  userIds: string[]
}

export interface AssignRadiusUsersToZoneDto {
  radiusUserIds: number[]
}

export const zoneApi = {
  // Get all zones
  getZones: async (workspaceId: number): Promise<Zone[]> => {
    const response = await apiClient.get(`/api/workspace/${workspaceId}/zone`)
    return response.data
  },

  // Get single zone
  getZone: async (workspaceId: number, zoneId: number): Promise<Zone> => {
    const response = await apiClient.get(`/api/workspace/${workspaceId}/zone/${zoneId}`)
    return response.data
  },

  // Create zone
  createZone: async (workspaceId: number, data: ZoneCreateDto): Promise<Zone> => {
    const response = await apiClient.post(`/api/workspace/${workspaceId}/zone`, data)
    return response.data
  },

  // Update zone
  updateZone: async (workspaceId: number, zoneId: number, data: ZoneUpdateDto): Promise<Zone> => {
    const response = await apiClient.put(`/api/workspace/${workspaceId}/zone/${zoneId}`, data)
    return response.data
  },

  // Delete zone
  deleteZone: async (workspaceId: number, zoneId: number): Promise<void> => {
    await apiClient.delete(`/api/workspace/${workspaceId}/zone/${zoneId}`)
  },

  // Assign users to zone
  assignUsersToZone: async (
    workspaceId: number,
    zoneId: number,
    data: AssignUsersToZoneDto
  ): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post(
      `/api/workspace/${workspaceId}/zone/${zoneId}/assign-users`,
      data
    )
    return response.data
  },

  // Get zone users
  getZoneUsers: async (workspaceId: number, zoneId: number): Promise<string[]> => {
    const response = await apiClient.get(`/api/workspace/${workspaceId}/zone/${zoneId}/users`)
    return response.data
  },

  // Assign radius users to zone
  assignRadiusUsersToZone: async (
    workspaceId: number,
    zoneId: number,
    data: AssignRadiusUsersToZoneDto
  ): Promise<{ message: string; count: number }> => {
    const response = await apiClient.post(
      `/api/workspace/${workspaceId}/zone/${zoneId}/assign-radius-users`,
      data
    )
    return response.data
  },

  // Get zone radius users
  getZoneRadiusUsers: async (
    workspaceId: number,
    zoneId: number
  ): Promise<Array<{
    id: number
    username: string
    firstname: string
    lastname: string
    email: string
    phone: string
  }>> => {
    const response = await apiClient.get(`/api/workspace/${workspaceId}/zone/${zoneId}/radius-users`)
    return response.data
  },
}
