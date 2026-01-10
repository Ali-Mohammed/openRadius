import { apiClient } from '../lib/api';

export interface Olt {
  id: string;
  name: string;
  vendor: string;
  model: string;
  managementIp: string;
  managementVlan?: number;
  status: string;
  siteName?: string;
  ponPortCount: number;
  createdAt: string;
}

export interface OltDetail extends Olt {
  serialNumber?: string;
  firmwareVersion?: string;
  sshEnabled: boolean;
  sshPort: number;
  sshUsername?: string;
  snmpEnabled: boolean;
  snmpVersion?: string;
  snmpCommunity?: string;
  snmpPort: number;
  apiEnabled: boolean;
  apiPort?: number;
  apiUsername?: string;
  uptimeSeconds?: number;
  cpuUsagePct?: number;
  memoryUsagePct?: number;
  temperatureC?: number;
  lastPollAt?: string;
  latitude?: number;
  longitude?: number;
  rack?: string;
  location?: string;
  notes?: string;
  ponPorts: PonPort[];
  updatedAt: string;
}

export interface PonPort {
  id: string;
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
  vendor: string;
  model: string;
  managementIp: string;
  managementVlan?: number;
  serialNumber?: string;
  firmwareVersion?: string;
  sshEnabled: boolean;
  sshPort: number;
  sshUsername?: string;
  sshPassword?: string;
  snmpEnabled: boolean;
  snmpVersion?: string;
  snmpCommunity?: string;
  snmpPort: number;
  apiEnabled: boolean;
  apiPort?: number;
  apiUsername?: string;
  apiPassword?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  siteName?: string;
  rack?: string;
  location?: string;
  notes?: string;
}

export interface UpdateOltData extends CreateOltData {}

export const oltApi = {
  getAll: async () => {
    const { data } = await apiClient.get<Olt[]>('/api/network/olts');
    return data;
  },
  
  getById: async (id: string) => {
    const { data } = await apiClient.get<OltDetail>(`/api/network/olts/${id}`);
    return data;
  },
  
  create: async (data: CreateOltData) => {
    const { data: result } = await apiClient.post<Olt>('/api/network/olts', data);
    return result;
  },
  
  update: async (id: string, updateData: UpdateOltData) => {
    await apiClient.put(`/api/network/olts/${id}`, updateData);
  },
  
  delete: async (id: string) => {
    await apiClient.delete(`/api/network/olts/${id}`);
  },
};
