import { apiClient } from '@/lib/api'

export interface PaymentMethodSettings {
  isProduction?: boolean
  // ZainCash (v1)
  msisdnProd?: string
  msisdnTest?: string
  merchantProd?: string
  merchantTest?: string
  secretProd?: string
  secretTest?: string
  langProd?: string
  langTest?: string
  token?: string
  // ZainCash V2 (OAuth2 + REST API)
  clientIdProd?: string
  clientIdTest?: string
  clientSecretProd?: string
  clientSecretTest?: string
  baseUrlProd?: string
  baseUrlTest?: string
  serviceTypeProd?: string
  serviceTypeTest?: string
  apiKeyProd?: string
  apiKeyTest?: string
  scope?: string
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
  publicKeyProd?: string
  publicKeyTest?: string
  // Switch
  entityIdProd?: string
  entityIdTest?: string
  entityAuthProd?: string
  entityAuthTest?: string
  entityUrlProd?: string
  entityUrlTest?: string
  decodeKey?: string
  // Common
  isActive?: boolean
}

export type PaymentMethodType = 'ZainCash' | 'ZainCashV2' | 'QICard' | 'Switch'

export interface PaymentMethod {
  id?: number
  type: PaymentMethodType
  name: string
  isActive: boolean
  settings: PaymentMethodSettings
}

export interface CreatePaymentMethodDto {
  type: PaymentMethodType
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
