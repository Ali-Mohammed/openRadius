import { apiClient } from '@/lib/api'

export interface PaymentMethodSettings {
  isProduction?: boolean
  // ZainCash
  msisdnProd?: string
  msisdnTest?: string
  merchantProd?: string
  merchantTest?: string
  secretProd?: string
  secretTest?: string
  langProd?: string
  langTest?: string
  token?: string
  // QICard
  usernameProd?: string
  usernameTest?: string
  passwordProd?: string
  passwordTest?: string
  terminalIdProd?: string
  terminalIdTest?: string
  currencyProd?: string
  currencyTest?: string
  urlProd?: string
  urlTest?: string
  // Switch
  entityIdProd?: string
  entityIdTest?: string
  entityAuthProd?: string
  entityAuthTest?: string
  entityUrlProd?: string
  entityUrlTest?: string
  decodeKey?: string
  // Common
  frontendCallbackUrl?: string
  backendCallbackUrl?: string
  isActive?: boolean
}

export interface PaymentMethod {
  id?: number
  type: 'ZainCash' | 'QICard' | 'Switch'
  name: string
  isActive: boolean
  settings: PaymentMethodSettings
}

export interface CreatePaymentMethodDto {
  type: 'ZainCash' | 'QICard' | 'Switch'
  name: string
  isActive: boolean
  settings: PaymentMethodSettings
}

export interface UpdatePaymentMethodDto {
  name?: string
  isActive?: boolean
  settings?: PaymentMethodSettings
}

class PaymentMethodApi {
  async getAll(workspaceId: number): Promise<PaymentMethod[]> {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/payment-methods`)
    return response.data
  }

  async getById(workspaceId: number, id: number): Promise<PaymentMethod> {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/payment-methods/${id}`)
    return response.data
  }

  async create(workspaceId: number, dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/payment-methods`, dto)
    return response.data
  }

  async update(workspaceId: number, id: number, dto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    const response = await apiClient.put(`/api/workspaces/${workspaceId}/payment-methods/${id}`, dto)
    return response.data
  }

  async delete(workspaceId: number, id: number): Promise<void> {
    await apiClient.delete(`/api/workspaces/${workspaceId}/payment-methods/${id}`)
  }
}

export const paymentMethodApi = new PaymentMethodApi()
