import { apiClient } from '../lib/api';

export interface Fat {
  id: string;
  code: string;
  name?: string;
  capacity: number;
  usedPorts: number;
  status: string;
  address?: string;
  fdtCode: string;
  oltName: string;
  portCount: number;
  createdAt: string;
}

export interface FatDetail extends Fat {
  fdtId: string;
  coverageRadiusM?: number;
  installation?: string;
  latitude?: number;
  longitude?: number;
  lastInspectionAt?: string;
  notes?: string;
  fdtName?: string;
  ports: FatPort[];
  updatedAt: string;
}

export interface FatPort {
  id: string;
  portNumber: number;
  status: string;
  subscriberId?: string;
}

export interface CreateFatData {
  code: string;
  name?: string;
  fdtId: string;
  capacity: number;
  coverageRadiusM?: number;
  installation?: string;
  status?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface UpdateFatData extends CreateFatData {
  lastInspectionAt?: string;
}

export const fatApi = {
  getAll: async () => {
    const { data } = await apiClient.get<Fat[]>('/api/network/fats');
    return data;
  },
  
  getById: async (id: string) => {
    const { data } = await apiClient.get<FatDetail>(`/api/network/fats/${id}`);
    return data;
  },
  
  create: async (data: CreateFatData) => {
    const { data: result } = await apiClient.post<Fat>('/api/network/fats', data);
    return result;
  },
  
  update: async (id: string, updateData: UpdateFatData) => {
    await apiClient.put(`/api/network/fats/${id}`, updateData);
  },
  
  delete: async (id: string) => {
    await apiClient.delete(`/api/network/fats/${id}`);
  },
};
