import { apiClient } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────

export interface CpuInfo {
  usagePercent: number
  cores: number
  model: string
}

export interface MemoryInfo {
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
  swapTotalBytes: number
  swapUsedBytes: number
}

export interface DiskPartition {
  filesystem: string
  mountPoint: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
}

export interface DiskInfo {
  partitions: DiskPartition[]
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
}

export interface ServerResources {
  cpu: CpuInfo
  memory: MemoryInfo
  disk: DiskInfo
  hostname: string
  os: string
  kernel: string
  uptime: string
  loadAverage1: number
  loadAverage5: number
  loadAverage15: number
  collectedAt: string
}

export interface ContainerResourceUsage {
  cpuPercent: string
  memoryUsage: string
  memoryPercent: number
  netIO: string
  blockIO: string
  pids: number
}

export interface ContainerInfo {
  id: string
  shortId: string
  name: string
  image: string
  status: string
  state: string
  created: string
  ports: string
  resources: ContainerResourceUsage
}

export interface ContainerStats {
  containerId: string
  containerName: string
  resources: ContainerResourceUsage
  collectedAt: string
}

export interface ContainerActionResult {
  success: boolean
  message: string
  containerId: string
  action: string
  performedAt: string
}

export interface ContainerLogs {
  containerId: string
  containerName: string
  logs: string[]
  lineCount: number
  collectedAt: string
}

export interface DockerSystemInfo {
  serverVersion: string
  apiVersion: string
  os: string
  architecture: string
  totalContainers: number
  runningContainers: number
  stoppedContainers: number
  pausedContainers: number
  images: number
  storageDriver: string
  dockerRootDir: string
  totalMemory: string
  cpus: number
  kernelVersion: string
  operatingSystem: string
  collectedAt: string
}

// ── API ───────────────────────────────────────────────────────────────────

export const serverMonitoringApi = {
  /** Get host server resources (CPU, RAM, disk, uptime) */
  getServerResources: async (): Promise<ServerResources> => {
    const { data } = await apiClient.get<ServerResources>('/api/server-monitoring/resources')
    return data
  },

  /** Get Docker daemon system info */
  getDockerInfo: async (): Promise<DockerSystemInfo> => {
    const { data } = await apiClient.get<DockerSystemInfo>('/api/server-monitoring/docker/info')
    return data
  },

  /** Get all containers with status and live stats */
  getContainers: async (includeAll = true): Promise<ContainerInfo[]> => {
    const { data } = await apiClient.get<ContainerInfo[]>('/api/server-monitoring/containers', {
      params: { includeAll },
    })
    return data
  },

  /** Get detailed stats for a specific container */
  getContainerStats: async (containerId: string): Promise<ContainerStats> => {
    const { data } = await apiClient.get<ContainerStats>(
      `/api/server-monitoring/containers/${encodeURIComponent(containerId)}/stats`
    )
    return data
  },

  /** Start a stopped container */
  startContainer: async (containerId: string): Promise<ContainerActionResult> => {
    const { data } = await apiClient.post<ContainerActionResult>(
      `/api/server-monitoring/containers/${encodeURIComponent(containerId)}/start`
    )
    return data
  },

  /** Stop a running container */
  stopContainer: async (containerId: string): Promise<ContainerActionResult> => {
    const { data } = await apiClient.post<ContainerActionResult>(
      `/api/server-monitoring/containers/${encodeURIComponent(containerId)}/stop`
    )
    return data
  },

  /** Restart a container */
  restartContainer: async (containerId: string): Promise<ContainerActionResult> => {
    const { data } = await apiClient.post<ContainerActionResult>(
      `/api/server-monitoring/containers/${encodeURIComponent(containerId)}/restart`
    )
    return data
  },

  /** Get container logs */
  getContainerLogs: async (
    containerId: string,
    tail = 200,
    timestamps = true
  ): Promise<ContainerLogs> => {
    const { data } = await apiClient.get<ContainerLogs>(
      `/api/server-monitoring/containers/${encodeURIComponent(containerId)}/logs`,
      { params: { tail, timestamps } }
    )
    return data
  },
}
