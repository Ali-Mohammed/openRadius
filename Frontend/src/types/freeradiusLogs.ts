export interface FreeRadiusLogEntry {
  timestamp: string;
  level: string; // Debug, Info, Warning, Error, Auth
  message: string;
  username?: string;
  nasIpAddress?: string;
  clientIpAddress?: string;
  authResult?: string; // Accept, Reject, Challenge
  rawLine: string;
}

export interface LogFilter {
  logType: string; // radius, auth, radwtmp
  lines: number;
  searchTerm?: string;
  level?: string;
  username?: string;
  startDate?: string;
  endDate?: string;
  follow?: boolean;
}

export interface LogsResponse {
  entries: FreeRadiusLogEntry[];
  totalLines: number;
  logType: string;
  isRealTime: boolean;
}

export interface LogStatistics {
  totalAuthentications: number;
  successfulAuths: number;
  failedAuths: number;
  totalAccounting: number;
  errorCounts: Record<string, number>;
  lastUpdated: string;
}

export interface RadwtmpEntry {
  username: string;
  nasIpAddress: string;
  loginTime: string;
  logoutTime?: string;
  duration: string;
  isOnline: boolean;
}

export interface LogType {
  value: string;
  label: string;
  description: string;
}
