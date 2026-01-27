import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '../../components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { sasActivationsApi } from '../../api/sasActivationsApi';
import { ActivationStatus, type SasActivationLog } from '../../types/sasActivation';
import { formatDistance } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Loader2, RotateCcw, AlertCircle, Ban } from 'lucide-react';
import { toast } from 'sonner';

interface ActivationLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: number;
  integrationName: string;
}

const statusConfig = {
  [ActivationStatus.Pending]: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-700'
  },
  [ActivationStatus.Processing]: {
    label: 'Processing',
    icon: Loader2,
    variant: 'default' as const,
    className: 'bg-blue-100 text-blue-700'
  },
  [ActivationStatus.Success]: {
    label: 'Success',
    icon: CheckCircle2,
    variant: 'default' as const,
    className: 'bg-green-100 text-green-700'
  },
  [ActivationStatus.Failed]: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive' as const,
    className: 'bg-red-100 text-red-700'
  },
  [ActivationStatus.MaxRetriesReached]: {
    label: 'Max Retries',
    icon: AlertCircle,
    variant: 'destructive' as const,
    className: 'bg-orange-100 text-orange-700'
  },
  [ActivationStatus.Cancelled]: {
    label: 'Cancelled',
    icon: Ban,
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-700'
  }
};

export function ActivationLogsDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  integrationName 
}: ActivationLogsDialogProps) {
  const [page, setPage] = useState(1);
  const [retryPeriod, setRetryPeriod] = useState<string>('1d');
  
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['activation-logs', integrationId, page],
    queryFn: () => sasActivationsApi.getActivationLogs(integrationId, page, 50),
    enabled: open
  });

  const retryMutation = useMutation({
    mutationFn: (period?: string) => 
      sasActivationsApi.retryFailedActivations(integrationId, period),
    onSuccess: (data) => {
      toast.success(`Retrying ${data.count} failed activations`);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to retry activations: ${error.message}`);
    }
  });

  const handleRetry = () => {
    retryMutation.mutate(retryPeriod);
  };

  const handleRetryAll = () => {
    retryMutation.mutate(undefined);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activation Logs - {integrationName}</DialogTitle>
          <DialogDescription>
            View and manage activation attempts sent to SAS4
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Retry Controls */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-medium">Retry failed from:</span>
              <Select value={retryPeriod} onValueChange={setRetryPeriod}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Last 24 hours</SelectItem>
                  <SelectItem value="2d">Last 2 days</SelectItem>
                  <SelectItem value="3d">Last 3 days</SelectItem>
                  <SelectItem value="1w">Last week</SelectItem>
                  <SelectItem value="2w">Last 2 weeks</SelectItem>
                  <SelectItem value="1m">Last month</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleRetry} 
                disabled={retryMutation.isPending}
                size="sm"
              >
                {retryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Selected Period
                  </>
                )}
              </Button>
            </div>
            <Button 
              onClick={handleRetryAll} 
              disabled={retryMutation.isPending}
              variant="outline"
              size="sm"
            >
              Retry All Failed
            </Button>
          </div>

          {/* Activation Logs Table */}
          <div className="border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : logs && logs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Next Retry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const config = statusConfig[log.status];
                    const StatusIcon = config.icon;
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.createdAt).toLocaleString()}
                          <div className="text-xs text-gray-500">
                            {formatDistance(new Date(log.createdAt), new Date(), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{log.username}</div>
                          <div className="text-xs text-gray-500">ID: {log.userId}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={config.className}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.durationMs > 0 ? formatDuration(log.durationMs) : '-'}
                          {log.responseStatusCode && (
                            <div className="text-xs text-gray-500">
                              HTTP {log.responseStatusCode}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.retryCount} / {log.maxRetries}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">
                          {log.errorMessage ? (
                            <span className="text-red-600 truncate block" title={log.errorMessage}>
                              {log.errorMessage}
                            </span>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.nextRetryAt ? (
                            <>
                              {formatDistance(new Date(log.nextRetryAt), new Date(), { addSuffix: true })}
                            </>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                <Clock className="h-12 w-12 mb-4 text-gray-300" />
                <p>No activation logs found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Page {page}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={!logs || logs.length < 50}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
