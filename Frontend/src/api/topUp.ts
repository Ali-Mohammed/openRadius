import { apiClient } from '../lib/api'

export interface TopUpRequest {
  walletType: 'custom' | 'user'
  customWalletId?: number
  userWalletId?: number
  amount: number
  reason?: string
  reference?: string
}

export interface TopUpResponse {
  success: boolean
  walletId: number
  walletName?: string
  userId?: number
  balanceBefore: number
  balanceAfter: number
  amount: number
  historyId: number
}

const topUpApi = {
  customWallet: async (request: TopUpRequest): Promise<TopUpResponse> => {
    const response = await apiClient.post('/api/topup/custom-wallet', request)
    return response.data
  },

  userWallet: async (request: TopUpRequest): Promise<TopUpResponse> => {
    const response = await apiClient.post('/api/topup/user-wallet', request)
    return response.data
  },
}

export default topUpApi
