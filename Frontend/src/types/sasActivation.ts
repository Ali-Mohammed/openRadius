export interface SasActivationLog {
  id: number;
  integrationId: number;
  integrationName: string;
  userId: number;
  username: string;
  activationData: string;
  status: ActivationStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  processedAt?: string;
  durationMs: number;
  responseBody?: string;
  responseStatusCode?: number;
  errorMessage?: string;
  jobId?: string;
  nextRetryAt?: string;
}

export const enum ActivationStatus {
  Pending = 0,
  Processing = 1,
  Success = 2,
  Failed = 3,
  MaxRetriesReached = 4,
  Cancelled = 5
}

export interface ActivationLogResponse {
  logs: SasActivationLog[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface RetryRequest {
  integrationId: number;
  fromDate?: string;
}

export interface RetryResponse {
  message: string;
  count: number;
  fromDate?: string;
}

export interface TestActivationRequest {
  userId: number;
  username?: string;
  integrationName?: string;
  data?: any;
}
