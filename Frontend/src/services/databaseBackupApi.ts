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
  fileName: string;
  sizeBytes: number;
  createdAt: string;
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

  getBackupHistory: async (): Promise<BackupHistoryItem[]> => {
    const { data } = await apiClient.get<BackupHistoryItem[]>('/api/database-backup/backup-history');
    return data;
  },
};
