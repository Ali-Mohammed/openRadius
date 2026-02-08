import { apiClient } from '@/lib/api'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ServiceUpdateInfo {
  serviceName: string
  imageName: string
  tag: string
  containerName: string
  currentDigest: string | null
  currentCreatedAt: string | null
  currentStatus: string | null
  latestDigest: string | null
  latestPushedAt: string | null
  latestSizeBytes: number | null
  updateAvailable: boolean
  status: 'up-to-date' | 'update-available' | 'container-not-found' | 'error' | 'unknown'
  errorMessage: string | null
}

export interface SystemUpdateStatusResponse {
  services: ServiceUpdateInfo[]
  checkedAt: string
}

export interface ServiceUpdateResult {
  success: boolean
  serviceName: string
  message: string
  oldDigest: string | null
  newDigest: string | null
  updatedAt: string
}

export interface PreUpdateCheckItem {
  name: string
  passed: boolean
  message: string
}

export interface PreUpdateCheckResult {
  ready: boolean
  checks: PreUpdateCheckItem[]
  warnings: string[]
}

export interface UpdateSelectedRequest {
  services: string[]
  backupConfirmed: boolean
}

// ── API ─────────────────────────────────────────────────────────────────────

export const systemUpdateApi = {
  /** Check Docker Hub for latest versions vs running containers */
  getStatus: async (): Promise<SystemUpdateStatusResponse> => {
    const { data } = await apiClient.get('/api/system-update/status')
    return data
  },

  /** Pull and restart a specific service (backend or frontend) */
  updateService: async (serviceName: string): Promise<ServiceUpdateResult> => {
    const { data } = await apiClient.post(`/api/system-update/update/${serviceName}`)
    return data
  },

  /** Pull and restart both backend and frontend */
  updateAll: async (): Promise<ServiceUpdateResult[]> => {
    const { data } = await apiClient.post('/api/system-update/update-all')
    return data
  },

  /** Pull and restart only the selected services */
  updateSelected: async (request: UpdateSelectedRequest): Promise<ServiceUpdateResult[]> => {
    const { data } = await apiClient.post('/api/system-update/update-selected', request)
    return data
  },

  /** Run pre-update health checks for the selected services */
  preCheck: async (services: string[]): Promise<PreUpdateCheckResult> => {
    const { data } = await apiClient.post('/api/system-update/pre-check', { services })
    return data
  },
}
