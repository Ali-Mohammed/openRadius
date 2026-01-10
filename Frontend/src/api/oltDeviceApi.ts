import { apiClient } from '../lib/api'

export interface OltDevice {
  id: number
  name: string
  status: 'active' | 'inactive' | 'maintenance'
  createdAt: string
  updatedAt: string
}

export interface CreateOltDeviceDto {
  name: string
  status: 'active' | 'inactive' | 'maintenance'
}

export interface UpdateOltDeviceDto {
  name: string
  status: 'active' | 'inactive' | 'maintenance'
}

export const oltDeviceApi = {
  getDevices: async (): Promise<OltDevice[]> => {
    const response = await apiClient.get('/api/network/olt-devices')
    return response.data
  },

  getDevice: async (id: number): Promise<OltDevice> => {
    const response = await apiClient.get(`/api/network/olt-devices/${id}`)
    return response.data
  },

  createDevice: async (data: CreateOltDeviceDto): Promise<OltDevice> => {
    const response = await apiClient.post('/api/network/olt-devices', data)
    return response.data
  },

  updateDevice: async (id: number, data: UpdateOltDeviceDto): Promise<void> => {
    await apiClient.put(`/api/network/olt-devices/${id}`, data)
  },

  deleteDevice: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/network/olt-devices/${id}`)
  },
}
