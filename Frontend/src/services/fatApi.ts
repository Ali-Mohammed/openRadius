import api from '../lib/api';

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
  getAll: () => api.get<Fat[]>('/api/network/fats'),
  
  getById: (id: string) => api.get<FatDetail>(`/api/network/fats/${id}`),
  
  create: (data: CreateFatData) => api.post<Fat>('/api/network/fats', data),
  
  update: (id: string, data: UpdateFatData) => 
    api.put(`/api/network/fats/${id}`, data),
  
  delete: (id: string) => api.delete(`/api/network/fats/${id}`),
};
