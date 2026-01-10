import { apiClient } from '../lib/api';

export interface Fat {
  id: string;
  code: string;
  name?: string;
  fdtId: string;
  capacity: number;
  usedPorts: number;
  coverageRadiusM?: number;
  installation?: string;
  status: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  lastInspectionAt?: string;
  fdtCode: string;
  fdtName?: string;
  oltName: string;
  portCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FatDetail extends Fat {
  notes?: string;
  ports: FatPort[];
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

export interface PaginatedFatsResponse {
  data: Fat[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export const fatApi = {
  getAll: async (
    page: number = 1,
    pageSize: number = 50,
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (search) params.append('search', search);
    if (sortField) params.append('sortField', sortField);
    if (sortDirection) params.append('sortDirection', sortDirection);

    const { data } = await apiClient.get<PaginatedFatsResponse>(`/api/network/fats?${params.toString()}`);
    return data;
  },

  getTrash: async (page: number = 1, pageSize: number = 50) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    const { data } = await apiClient.get<PaginatedFatsResponse>(`/api/network/fats/trash?${params.toString()}`);
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

  restore: async (id: string) => {
    await apiClient.post(`/api/network/fats/${id}/restore`);
  },

  exportToCsv: async (search?: string, sortField?: string, sortDirection?: 'asc' | 'desc') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (sortField) params.append('sortField', sortField);
    if (sortDirection) params.append('sortDirection', sortDirection);

    const { data } = await apiClient.get(`/api/network/fats/export/csv?${params.toString()}`, {
      responseType: 'blob',
    });
    return data;
  },

  exportToExcel: async (search?: string, sortField?: string, sortDirection?: 'asc' | 'desc') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (sortField) params.append('sortField', sortField);
    if (sortDirection) params.append('sortDirection', sortDirection);

    const { data } = await apiClient.get(`/api/network/fats/export/excel?${params.toString()}`, {
      responseType: 'blob',
    });
    return data;
  },
};
