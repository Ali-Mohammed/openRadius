import { apiClient } from '../lib/api';

export interface DatabaseInfo {
  name: string;
  displayName: string;
  type: string;
  workspaceId?: string;
  connectionString: string;
}

export interface BackupHistoryItem {
  id: string;
  databaseName: string;
  databaseType: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
}

export const databaseBackupApi = {
  getDatabases: async (): Promise<DatabaseInfo[]> => {
    const { data } = await apiClient.get<DatabaseInfo[]>('/api/database-backup/list');
    return data;
  },

  backupDatabase: async (databaseName: string, type: string): Promise<Blob> => {
    const response = await apiClient.post(
      '/api/database-backup/backup',
      { databaseName, type },
      { responseType: 'blob' }
    );
    return response.data;
  },

  getBackupHistory: async (databaseName?: string): Promise<BackupHistoryItem[]> => {
    const params = databaseName ? { databaseName } : {};
    const { data } = await apiClient.get<BackupHistoryItem[]>('/api/database-backup/backup-history', { params });
    return data;
  },

  downloadBackup: async (backupId: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/api/database-backup/download/${backupId}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  restoreBackup: async (backupId: string): Promise<void> => {
    await apiClient.post('/api/database-backup/restore', { backupId });
  },

  deleteBackup: async (backupId: string): Promise<void> => {
    await apiClient.delete(`/api/database-backup/delete/${backupId}`);
  },

  uploadBackup: async (file: File, databaseName: string, databaseType: string): Promise<{ backupId: string; fileName: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('databaseName', databaseName);
    formData.append('databaseType', databaseType);
    
    const { data } = await apiClient.post<{ backupId: string; fileName: string }>(
      '/api/database-backup/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data;
  },
};
