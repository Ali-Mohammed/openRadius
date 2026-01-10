import { apiClient } from '../lib/api';

export interface Olt {
  id: string;
  name: string;
  hostname?: string;
  vendor: string;
  model: string;
  serialNumber?: string;
  assetTag?: string;
  role?: string;
  managementIp: string;
  managementVlan?: number;
  loopbackIp?: string;
  mgmtInterface?: string;
  status: string;
  environment: string;
  sshEnabled: boolean;
  sshPort: number;
  sshUsername?: string;
  snmpVersion?: string;
  snmpPort: number;
  siteName?: string;
  rack?: string;
  rackUnit?: number;
  latitude?: number;
  longitude?: number;
  ponPortCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OltDetail extends Olt {
  assetTag?: string;
  role?: string;
  loopbackIp?: string;
  mgmtInterface?: string;
  sshEnabled: boolean;
  sshPort: number;
  sshUsername?: string;
  snmpVersion?: string;
  snmpPort: number;
  rack?: string;
  rackUnit?: number;
  latitude?: number;
  longitude?: number;
  uptimeSeconds?: number;
  cpuUsagePct?: number;
  memoryUsagePct?: number;
  temperatureC?: number;
  ponPorts: PonPort[];
}

export interface PonPort {
  id: string;
  slot: number;
  port: number;
  technology: string;
  status: string;
}

export interface PonPortDetail {
  id: string;
  slot: number;
  port: number;
  technology: string;
  maxSplitRatio?: number;
  currentSplitRatio?: number;
  txPowerDbm?: number;
  rxPowerDbm?: number;
  status: string;
  createdAt: string;
}

export interface PonPortList {
  id: string;
  oltId: string;
  oltName: string;
  slot: number;
  port: number;
  technology: string;
  status: string;
  label: string;
}

export interface CreatePonPortData {
  slot: number;
  port: number;
  technology: string;
  maxSplitRatio?: number;
  status?: string;
}

export interface UpdatePonPortData {
  slot: number;
  port: number;
  technology: string;
  maxSplitRatio?: number;
  currentSplitRatio?: number;
  txPowerDbm?: number;
  rxPowerDbm?: number;
  status: string;
}

export interface CreateOltData {
  name: string;
  hostname?: string;
  vendor: string;
  model: string;
  managementIp: string;
  managementVlan?: number;
  serialNumber?: string;
  assetTag?: string;
  role?: string;
  environment?: string;
  status?: string;
  loopbackIp?: string;
  mgmtInterface?: string;
  sshEnabled?: boolean;
  sshPort?: number;
  sshUsername?: string;
  sshPassword?: string;
  snmpVersion?: string;
  snmpPort?: number;
  siteName?: string;
  rack?: string;
  rackUnit?: number;
  latitude?: number;
  longitude?: number;
}

export interface UpdateOltData extends CreateOltData {}

export interface PaginatedOltsResponse {
  data: Olt[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export const oltApi = {
  getAll: async (
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<PaginatedOltsResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (search) params.append('search', search);
    if (sortField) params.append('sortField', sortField);
    if (sortDirection) params.append('sortDirection', sortDirection);
    
    const { data } = await apiClient.get<PaginatedOltsResponse>(`/api/network/olts?${params.toString()}`);
    return data;
  },
  
  getById: async (id: string): Promise<OltDetail> => {
    const { data } = await apiClient.get<OltDetail>(`/api/network/olts/${id}`);
    return data;
  },
  
  create: async (createData: CreateOltData): Promise<Olt> => {
    const { data } = await apiClient.post<Olt>('/api/network/olts', createData);
    return data;
  },
  
  update: async (id: string, updateData: UpdateOltData): Promise<void> => {
    await apiClient.put(`/api/network/olts/${id}`, updateData);
  },
  
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/network/olts/${id}`);
  },

  restore: async (id: string): Promise<void> => {
    await apiClient.post(`/api/network/olts/${id}/restore`);
  },

  getTrash: async (
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedOltsResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    const { data } = await apiClient.get<PaginatedOltsResponse>(`/api/network/olts/trash?${params.toString()}`);
    return data;
  },

  exportToCsv: async (
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (sortField) params.append('sortField', sortField);
    if (sortDirection) params.append('sortDirection', sortDirection);
    
    const response = await apiClient.get(
      `/api/network/olts/export/csv?${params.toString()}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  exportToExcel: async (
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (sortField) params.append('sortField', sortField);
    if (sortDirection) params.append('sortDirection', sortDirection);
    
    const response = await apiClient.get(
      `/api/network/olts/export/excel?${params.toString()}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  getPonPorts: async (): Promise<PonPortList[]> => {
    const { data } = await apiClient.get<PonPortList[]>('/api/network/olts/pon-ports');
    return data;
  },

  getOltPonPorts: async (oltId: string): Promise<PonPortDetail[]> => {
    const { data } = await apiClient.get<PonPortDetail[]>(`/api/network/olts/${oltId}/pon-ports`);
    return data;
  },

  createPonPort: async (oltId: string, ponPortData: CreatePonPortData): Promise<PonPort> => {
    const { data } = await apiClient.post<PonPort>(`/api/network/olts/${oltId}/pon-ports`, ponPortData);
    return data;
  },

  updatePonPort: async (ponPortId: string, ponPortData: UpdatePonPortData): Promise<void> => {
    await apiClient.put(`/api/network/olts/pon-ports/${ponPortId}`, ponPortData);
  },

  deletePonPort: async (ponPortId: string): Promise<void> => {
    await apiClient.delete(`/api/network/olts/pon-ports/${ponPortId}`);
  },
