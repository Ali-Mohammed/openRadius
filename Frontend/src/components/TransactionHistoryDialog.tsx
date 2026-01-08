import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import transactionApi from '@/api/transactions'
import { 
  FileText, 
  Trash2, 
  RotateCcw, 
  MessageSquare, 
  Plus,
  Clock
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface TransactionHistoryDialogProps {
  transactionId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransactionHistoryDialog({
  transactionId,
  open,
  onOpenChange,
}: TransactionHistoryDialogProps) {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['transaction-history', transactionId],
    queryFn: () => transactionApi.getHistory(transactionId),
    enabled: open && !!transactionId,
  })

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Created':
        return <Plus className="h-4 w-4" />
      case 'Deleted':
        return <Trash2 className="h-4 w-4" />
      case 'Restored':
        return <RotateCcw className="h-4 w-4" />
      case 'Comment Added':
        return <MessageSquare className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'Created':
        return 'bg-green-500/10 text-green-700 dark:text-green-400'
      case 'Deleted':
        return 'bg-red-500/10 text-red-700 dark:text-red-400'
      case 'Restored':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
      case 'Comment Added':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400'
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
    }
  }

  const parseChanges = (changes?: string) => {
    if (!changes) return null
    try {
      return JSON.parse(changes)
    } catch {
      return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Transaction History</DialogTitle>
          <DialogDescription>
            Complete history of all actions for transaction #{transactionId}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : historyData?.data && historyData.data.length > 0 ? (
            <div className="space-y-4">
              {historyData.data.map((item, index) => {
                const changes = parseChanges(item.changes)
                return (
                  <div
                    key={item.id}
                    className="flex gap-4 relative pb-4"
                    style={{
                      borderLeft:
                        index !== historyData.data.length - 1
                          ? '2px solid hsl(var(--border))'
                          : 'none',
                      marginLeft: '1rem',
                    }}
                  >
                    {/* Timeline dot/icon */}
                    <div
                      className={`absolute left-[-1.5rem] top-0 rounded-full p-2 ${getActionColor(
                        item.action
                      )}`}
                    >
                      {getActionIcon(item.action)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 ml-8">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getActionColor(item.action)}>
                              {item.action}
                            </Badge>
                            <span className="text-sm font-medium">{item.performedBy}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(item.performedAt), { addSuffix: true })}
                            <span className="mx-1">•</span>
                            {new Date(item.performedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Display changes if available */}
                      {changes && (
                        <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm">
                          {item.action === 'Created' && (
                            <div className="space-y-1">
                              <div><strong>Amount:</strong> {changes.amount}</div>
                              <div><strong>Type:</strong> {changes.transactionType}</div>
                              <div><strong>Status:</strong> {changes.status}</div>
                              {changes.description && (
                                <div><strong>Description:</strong> {changes.description}</div>
                              )}
                            </div>
                          )}

                          {item.action === 'Deleted' && changes.reason && (
                            <div>
                              <strong>Reason:</strong> {changes.reason}
                            </div>
                          )}

                          {item.action === 'Restored' && changes.restoredBy && (
                            <div>
                              <strong>Restored by:</strong> {changes.restoredBy}
                            </div>
                          )}

                          {item.action === 'Comment Added' && (
                            <div className="space-y-1">
                              <div><strong>Comment:</strong> {changes.comment}</div>
                              {changes.tags && changes.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap mt-2">
                                  <strong>Tags:</strong>
                                  {changes.tags.map((tag: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      #{tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {changes.hasAttachments && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  📎 Has attachments
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No history available for this transaction
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
