import { apiClient } from '../lib/api';

export interface Fdt {
  id: string;
  code: string;
  name?: string;
  capacity: number;
  usedPorts: number;
  status: string;
  zone?: string;
  oltName?: string;
  ponPortSlot: number;
  ponPortPort: number;
  fatCount: number;
  createdAt: string;
}

export interface FdtDetail extends Fdt {
  ponPortId: string;
  cabinet?: string;
  splitRatio?: string;
  installationDate?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  lastInspectionAt?: string;
  nextInspectionAt?: string;
  notes?: string;
  fdtName?: string;
  fats: FatSummary[];
  updatedAt: string;
}

export interface FatSummary {
  id: string;
  code: string;
  name?: string;
  capacity: number;
  usedPorts: number;
  status: string;
}

export interface CreateFdtData {
  code: string;
  name?: string;
  ponPortId: string;
  cabinet?: string;
  capacity: number;
  splitRatio?: string;
  installationDate?: string;
  status?: string;
  address?: string;
  zone?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface UpdateFdtData extends CreateFdtData {
  lastInspectionAt?: string;
  nextInspectionAt?: string;
}

export const fdtApi = {
  getAll: async () => {
    const { data } = await apiClient.get<Fdt[]>('/api/network/fdts');
    return data;
  },
  
  getById: async (id: string) => {
    const { data } = await apiClient.get<FdtDetail>(`/api/network/fdts/${id}`);
    return data;
  },
  
  create: async (data: CreateFdtData) => {
    const { data: result } = await apiClient.post<Fdt>('/api/network/fdts', data);
    return result;
  },
  
  update: async (id: string, updateData: UpdateFdtData) => {
    await apiClient.put(`/api/network/fdts/${id}`, updateData);
  },
  
  delete: async (id: string) => {
    await apiClient.delete(`/api/network/fdts/${id}`);
  },
};
