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
  async getAll(): Promise<PaymentMethod[]> {
    const response = await apiClient.get(`/api/payment-methods`)
    return response.data
  }

  async getById(id: number): Promise<PaymentMethod> {
    const response = await apiClient.get(`/api/payment-methods/${id}`)
    return response.data
  }

  async create(dto: CreatePaymentMethodDto): Promise<PaymentMethod> {
    const response = await apiClient.post(`/api/payment-methods`, dto)
    return response.data
  }

  async update(id: number, dto: UpdatePaymentMethodDto): Promise<PaymentMethod> {
    const response = await apiClient.put(`/api/payment-methods/${id}`, dto)
    return response.data
  }

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/api/payment-methods/${id}`)
  }
}

export const paymentMethodApi = new PaymentMethodApi()
