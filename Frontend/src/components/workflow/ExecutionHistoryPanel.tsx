import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getExecutionsByAutomation,
  getExecutionByUuid,
  type AutomationExecutionSummary,
  type AutomationExecutionDetail,
  type AutomationExecutionStep,
  type ExecutionStats,
} from '../../api/automationExecutions';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Globe,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface ExecutionHistoryPanelProps {
  automationUuid: string;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  completed: { color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/40', icon: CheckCircle2, label: 'Completed' },
  completed_with_errors: { color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/40', icon: AlertTriangle, label: 'Partial' },
  failed: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40', icon: XCircle, label: 'Failed' },
  running: { color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/40', icon: Loader2, label: 'Running' },
  skipped: { color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', icon: Clock, label: 'Skipped' },
};

const STEP_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  completed: { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/40' },
  failed: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40' },
  condition_true: { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  condition_false: { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  skipped: { color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
};

const TRIGGER_LABELS: Record<string, string> = {
  'user-created': 'User Created',
  'user-updated': 'User Updated',
  'user-activated': 'User Activated',
  'user-expired': 'User Expired',
  'user-churned': 'User Churned',
  'payment-received': 'Payment Received',
  'user-deleted': 'User Deleted',
};

export function ExecutionHistoryPanel({ automationUuid, onClose }: ExecutionHistoryPanelProps) {
  const [selectedExecutionUuid, setSelectedExecutionUuid] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Fetch execution list
  const { data: executionData, isLoading: listLoading } = useQuery({
    queryKey: ['automationExecutions', automationUuid, page],
    queryFn: () => getExecutionsByAutomation(automationUuid, { page, pageSize: 20 }),
    enabled: !!automationUuid,
  });

  // Fetch selected execution details
  const { data: executionDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['automationExecution', selectedExecutionUuid],
    queryFn: () => getExecutionByUuid(selectedExecutionUuid!),
    enabled: !!selectedExecutionUuid,
  });

  const executions = executionData?.items ?? [];
  const stats = executionData?.stats;
  const totalPages = executionData?.totalPages ?? 1;

  // Detail view
  if (selectedExecutionUuid) {
    return (
      <div className="absolute right-0 top-0 bottom-0 w-96 bg-white dark:bg-gray-900 border-l dark:border-gray-700 shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-3 py-2 border-b dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
          <button
            onClick={() => { setSelectedExecutionUuid(null); setExpandedStep(null); }}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to list
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-lg">×</button>
        </div>

        {detailLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : executionDetail ? (
          <div className="flex-1 overflow-y-auto">
            {/* Execution summary */}
            <ExecutionDetailHeader detail={executionDetail} />

            {/* Steps timeline */}
            <div className="px-3 py-2">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Execution Steps ({executionDetail.steps?.length ?? 0})
              </h4>
              <div className="space-y-1">
                {executionDetail.steps?.map((step) => (
                  <StepCard
                    key={step.uuid}
                    step={step}
                    isExpanded={expandedStep === step.uuid}
                    onToggle={() => setExpandedStep(expandedStep === step.uuid ? null : step.uuid)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            Execution not found
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Execution History
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="px-3 py-2 border-b bg-gray-50">
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatBadge label="Total" value={stats.totalExecutions} color="text-gray-700" />
            <StatBadge label="OK" value={stats.completed} color="text-green-600" />
            <StatBadge label="Partial" value={stats.completedWithErrors} color="text-amber-600" />
            <StatBadge label="Failed" value={stats.failed} color="text-red-600" />
          </div>
          {stats.avgExecutionTimeMs > 0 && (
            <div className="text-xs text-gray-500 text-center mt-1">
              Avg: {stats.avgExecutionTimeMs}ms
              {stats.lastExecutedAt && (
                <> · Last: {new Date(stats.lastExecutedAt).toLocaleDateString()}</>
              )}
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {listLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium">No executions yet</p>
            <p className="text-xs mt-1">Executions will appear here when<br />the automation workflow runs.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {executions.map((exec) => (
              <ExecutionListItem
                key={exec.uuid}
                execution={exec}
                onClick={() => setSelectedExecutionUuid(exec.uuid)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-3 py-2 border-t bg-gray-50 flex items-center justify-between text-xs">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-white"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-white"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function ExecutionListItem({
  execution,
  onClick,
}: {
  execution: AutomationExecutionSummary;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[execution.status] ?? STATUS_CONFIG.completed;
  const StatusIcon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 border rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}>
            <StatusIcon className={`h-3 w-3 ${execution.status === 'running' ? 'animate-spin' : ''}`} />
            {cfg.label}
          </span>
          <span className="text-xs text-gray-500">
            {TRIGGER_LABELS[execution.triggerType] ?? execution.triggerType}
          </span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-600" />
      </div>

      {execution.radiusUsername && (
        <div className="text-xs text-gray-600 mb-1">
          User: <span className="font-medium">{execution.radiusUsername}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{new Date(execution.createdAt).toLocaleString()}</span>
        <span>{execution.executionTimeMs}ms</span>
      </div>

      {execution.resultSummary && (
        <div className="text-xs text-gray-500 mt-1 truncate">{execution.resultSummary}</div>
      )}
    </button>
  );
}

function ExecutionDetailHeader({ detail }: { detail: AutomationExecutionDetail }) {
  const cfg = STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.completed;
  const StatusIcon = cfg.icon;

  return (
    <div className="px-3 py-3 border-b space-y-2">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${detail.status === 'running' ? 'animate-spin' : ''}`} />
          {cfg.label}
        </span>
        <span className="text-xs text-gray-500">
          {TRIGGER_LABELS[detail.triggerType] ?? detail.triggerType}
        </span>
      </div>

      {detail.resultSummary && (
        <p className="text-xs text-gray-700">{detail.resultSummary}</p>
      )}

      {detail.errorMessage && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {detail.errorMessage}
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded p-1.5">
          <div className="text-xs font-bold text-gray-700">{detail.nodesVisited}</div>
          <div className="text-xs text-gray-500">Visited</div>
        </div>
        <div className="bg-gray-50 rounded p-1.5">
          <div className="text-xs font-bold text-green-600">{detail.actionsSucceeded}</div>
          <div className="text-xs text-gray-500">Succeeded</div>
        </div>
        <div className="bg-gray-50 rounded p-1.5">
          <div className="text-xs font-bold text-red-600">{detail.actionsFailed}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-500 space-y-0.5">
        {detail.radiusUsername && <div>User: <span className="font-medium text-gray-700">{detail.radiusUsername}</span></div>}
        {detail.triggeredBy && <div>By: <span className="font-medium text-gray-700">{detail.triggeredBy}</span></div>}
        <div>Time: <span className="font-medium text-gray-700">{detail.executionTimeMs}ms</span></div>
        {detail.environment && <div>Env: <span className="font-medium text-gray-700">{detail.environment}</span></div>}
        <div>Correlation: <span className="font-mono text-gray-600 text-xs">{detail.correlationId.slice(0, 8)}...</span></div>
        <div>{new Date(detail.createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}

function StepCard({
  step,
  isExpanded,
  onToggle,
}: {
  step: AutomationExecutionStep;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const stepCfg = STEP_STATUS_CONFIG[step.status] ?? STEP_STATUS_CONFIG.completed;

  const nodeTypeIcon = {
    trigger: '⚡',
    action: '▶',
    condition: '◇',
    comment: '💬',
  }[step.nodeType] ?? '●';

  const isHttpStep = step.nodeSubType === 'http-request';

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-2.5 py-2 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400 w-4 text-right">{step.stepOrder}</span>
          <span className="text-sm">{nodeTypeIcon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-gray-800 truncate">
                {step.nodeLabel ?? step.nodeSubType ?? step.nodeType}
              </span>
              <span className={`inline-flex px-1 py-0.5 rounded text-xs ${stepCfg.bg} ${stepCfg.color}`}>
                {step.status.replace('_', ' ')}
              </span>
            </div>
            {step.result && !isExpanded && (
              <div className="text-xs text-gray-500 truncate mt-0.5">{step.result}</div>
            )}
          </div>
          <span className="text-xs text-gray-400">{step.executionTimeMs}ms</span>
          <ChevronRight className={`h-3 w-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {isExpanded && (
        <div className="px-2.5 pb-2.5 border-t bg-gray-50 space-y-2 text-xs">
          {step.result && (
            <div className="pt-2">
              <span className="font-semibold text-gray-600">Result: </span>
              <span className="text-gray-700">{step.result}</span>
            </div>
          )}

          {step.errorMessage && (
            <div className="text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {step.errorMessage}
            </div>
          )}

          {/* HTTP request details */}
          {isHttpStep && (
            <div className="space-y-2">
              {step.httpMethod && step.httpUrl && (
                <div className="bg-white p-2 rounded border space-y-1">
                  <div className="font-semibold text-gray-600 flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Request
                  </div>
                  <div className="font-mono text-gray-800">
                    <span className="font-bold text-blue-600">{step.httpMethod}</span>{' '}
                    <span className="break-all">{step.httpUrl}</span>
                  </div>
                  {step.httpRequestHeaders && (
                    <CollapsibleJson label="Headers" json={step.httpRequestHeaders} />
                  )}
                  {step.httpRequestBody && (
                    <CollapsibleJson label="Body" json={step.httpRequestBody} />
                  )}
                </div>
              )}

              {step.httpResponseStatusCode != null && (
                <div className="bg-white p-2 rounded border space-y-1">
                  <div className="font-semibold text-gray-600 flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    Response
                    <span className={`ml-1 font-bold ${step.httpResponseStatusCode < 400 ? 'text-green-600' : 'text-red-600'}`}>
                      {step.httpResponseStatusCode}
                    </span>
                    {step.httpResponseTimeMs != null && (
                      <span className="text-gray-400 font-normal ml-auto">{step.httpResponseTimeMs}ms</span>
                    )}
                  </div>
                  {step.httpResponseHeaders && (
                    <CollapsibleJson label="Headers" json={step.httpResponseHeaders} />
                  )}
                  {step.httpResponseBody && (
                    <CollapsibleJson label="Body" json={step.httpResponseBody} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Generic input/output */}
          {!isHttpStep && step.outputData && (
            <CollapsibleJson label="Output" json={step.outputData} />
          )}
        </div>
      )}
    </div>
  );
}

function CollapsibleJson({ label, json }: { label: string; json: string }) {
  const [open, setOpen] = useState(false);

  let formatted = json;
  try {
    const parsed = JSON.parse(json);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    // keep raw
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-0.5"
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        {label}
      </button>
      {open && (
        <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-40 text-gray-700 font-mono whitespace-pre-wrap break-all">
          {formatted}
        </pre>
      )}
    </div>
  );
}
