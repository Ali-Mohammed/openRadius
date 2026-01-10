import { apiClient } from '../lib/api';

export interface Fdt {
  id: string;
  code: string;
  name?: string;
  ponPortId: string;
  cabinet?: string;
  capacity: number;
  usedPorts: number;
  splitRatio?: string;
  installationDate?: string;
  status: string;
  address?: string;
  zone?: string;
  latitude?: number;
  longitude?: number;
  lastInspectionAt?: string;
  nextInspectionAt?: string;
  oltName?: string;
  ponPortSlot: number;
  ponPortPort: number;
  fatCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FdtDetail extends Fdt {
  notes?: string;
  fats: FatSummary[];
}

export interface FatSummary {
  id: string;
  code: string;
  name?: string;
  capacity: number;
  usedPorts: number;
  status: string;
}

export interface FdtList {
  id: string;
  code: string;
  name?: string;
  oltName: string;
  ponPortSlot: number;
  ponPortPort: number;
  label: string;
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

export interface PaginatedFdtsResponse {
  data: Fdt[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

export const fdtApi = {
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

    const { data } = await apiClient.get<PaginatedFdtsResponse>(`/api/network/fdts?${params.toString()}`);
    return data;
  },

  getTrash: async (page: number = 1, pageSize: number = 50) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    const { data } = await apiClient.get<PaginatedFdtsResponse>(`/api/network/fdts/trash?${params.toString()}`);
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

  restore: async (id: string) => {
    await apiClient.post(`/api/network/fdts/${id}/restore`);
  },

  exportToCsv: async (search?: string, sortField?: string, sortDirection?: 'asc' | 'desc') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (sortField) params.append('sortField', sortField);
    if (sortDirection) params.append('sortDirection', sortDirection);

    const { data } = await apiClient.get(`/api/network/fdts/export/csv?${params.toString()}`, {
      responseType: 'blob',
    });
    return data;
  },

  exportToExcel: async (search?: string, sortField?: string, sortDirection?: 'asc' | 'desc') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (sortField) params.append('sortField', sortField);
    if (sortDirection) params.append('sortDirection', sortDirection);

    const { data } = await apiClient.get(`/api/network/fdts/export/excel?${params.toString()}`, {
      responseType: 'blob',
    });
    return data;
  },

  getList: async () => {
    const { data } = await apiClient.get<FdtList[]>('/api/network/fdts/list');
    return data;
  },
};
