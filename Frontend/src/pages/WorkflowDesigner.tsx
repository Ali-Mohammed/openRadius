import React, { useCallback, useState, useRef, useEffect } from 'react';
import type { DragEvent } from 'react';
import { useParams } from 'react-router-dom';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  MiniMap,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TriggerNode } from '../components/workflow/TriggerNode';
import { ActionNode } from '../components/workflow/ActionNode';
import { ConditionNode } from '../components/workflow/ConditionNode';
import { CommentNode } from '../components/workflow/CommentNode';
import { Button } from '../components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  Save, 
  Play,
  UserPlus,
  UserCog,
  Clock,
  UserX,
  CreditCard,
  Trash2,
  Mail,
  Bell,
  Wallet,
  WalletCards,
  UserMinus,
  Percent,
  FileEdit,
  Scale,
  CheckCircle,
  Calendar,
  MessageSquare,
  History,
  RotateCcw,
  ShieldCheck,
  Globe,
  Activity,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MousePointerClick,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getAutomationById, updateAutomation, testAutomation, type TestAutomationResult, type TestStepResult } from '../api/automations';
import { workflowHistoryApi } from '../api/workflowHistory';
import { ExecutionHistoryPanel } from '../components/workflow/ExecutionHistoryPanel';


const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  comment: CommentNode,
};

// Event-based triggers — only for "on_action" automations
const ON_ACTION_TRIGGERS = [
  { value: 'user-created', label: 'User Created', description: 'When a new user is created', icon: UserPlus },
  { value: 'user-updated', label: 'User Updated', description: 'When user profile is updated', icon: UserCog },
  { value: 'user-activated', label: 'User Activated', description: 'When user subscription is activated', icon: ShieldCheck },
  { value: 'user-expired', label: 'User Expired', description: 'When user subscription expires', icon: Clock },
  { value: 'user-churned', label: 'User Churned', description: 'When user stops service', icon: UserX },
  { value: 'payment-received', label: 'Payment Received', description: 'When payment is received', icon: CreditCard },
  { value: 'user-deleted', label: 'User Deleted', description: 'When user is deleted', icon: Trash2 },
];

// Scheduled trigger — only for "scheduled" automations
const SCHEDULED_TRIGGERS = [
  { value: 'scheduled', label: 'Scheduled', description: 'Runs on a schedule (periodic or one-time)', icon: Clock },
];

// Manual trigger — only for "on_requested" automations
const MANUAL_TRIGGERS = [
  { value: 'manual-request', label: 'Manual Request', description: 'Triggered manually or via billing profile', icon: MousePointerClick },
];

// All triggers combined (for backwards compat)
const TRIGGER_TYPES = [...ON_ACTION_TRIGGERS, ...SCHEDULED_TRIGGERS, ...MANUAL_TRIGGERS];

const ACTION_TYPES = [
  { value: 'send-email', label: 'Send Email', description: 'Send an email notification', icon: Mail },
  { value: 'send-notification', label: 'Send Notification', description: 'Send in-app notification', icon: Bell },
  { value: 'credit-wallet', label: 'Credit Wallet', description: 'Add credits to user wallet', icon: Wallet },
  { value: 'debit-wallet', label: 'Debit Wallet', description: 'Deduct credits from wallet', icon: WalletCards },
  { value: 'suspend-user', label: 'Suspend User', description: 'Suspend user account', icon: UserMinus },
  { value: 'apply-discount', label: 'Apply Discount', description: 'Apply a discount code', icon: Percent },
  { value: 'update-profile', label: 'Update Profile', description: 'Update user profile fields', icon: FileEdit },
  { value: 'http-request', label: 'HTTP Request', description: 'Make an HTTP API call', icon: Globe },
];

const CONDITION_TYPES = [
  { value: 'balance-check', label: 'Check Balance', description: 'Check if balance meets condition', icon: Scale },
  { value: 'user-status', label: 'User Status', description: 'Check user status', icon: CheckCircle },
  { value: 'date-check', label: 'Date Check', description: 'Check date conditions', icon: Calendar },
];

const COMMENT_TYPES = [
  { value: 'note', label: 'Note', description: 'Add a note or comment', icon: MessageSquare },
  { value: 'todo', label: 'To-Do', description: 'Add a task reminder', icon: MessageSquare },
  { value: 'info', label: 'Info', description: 'Add information', icon: MessageSquare },
];

// ── Template variables available in HTTP request fields ──
const BUILT_IN_VARIABLES = [
  { key: 'username', label: 'Username', description: 'RADIUS username', category: 'Built-in' },
  { key: 'userId', label: 'User ID', description: 'Internal RADIUS user ID', category: 'Built-in' },
  { key: 'userUuid', label: 'User UUID', description: 'Public user UUID', category: 'Built-in' },
  { key: 'triggeredBy', label: 'Triggered By', description: 'Who performed the action', category: 'Built-in' },
  { key: 'triggerType', label: 'Trigger Type', description: 'Event type (e.g. user-updated)', category: 'Built-in' },
  { key: 'timestamp', label: 'Timestamp', description: 'When the event occurred (ISO 8601)', category: 'Built-in' },
];

const COMMON_CONTEXT_VARIABLES = [
  { key: 'email', label: 'Email', description: 'User email address', category: 'Context' },
  { key: 'phone', label: 'Phone', description: 'User phone number', category: 'Context' },
  { key: 'enabled', label: 'Enabled', description: 'User enabled status (true/false)', category: 'Context' },
  { key: 'balance', label: 'Balance', description: 'User wallet balance', category: 'Context' },
  { key: 'profileId', label: 'Profile ID', description: 'RADIUS profile ID', category: 'Context' },
  { key: 'expiration', label: 'Expiration', description: 'Subscription expiration date (ISO 8601)', category: 'Context' },
];

const TRIGGER_SPECIFIC_VARIABLES: Record<string, { key: string; label: string; description: string; category: string }[]> = {
  'user-created': [
    { key: 'groupId', label: 'Group ID', description: 'User group ID', category: 'User Created' },
    { key: 'zoneId', label: 'Zone ID', description: 'User zone ID', category: 'User Created' },
  ],
  'user-updated': [
    { key: 'changes', label: 'Changes', description: 'List of changed fields', category: 'User Updated' },
    { key: 'changeCount', label: 'Change Count', description: 'Number of fields changed', category: 'User Updated' },
  ],
  'user-activated': [
    { key: 'activationType', label: 'Activation Type', description: 'Type of activation', category: 'Activation' },
    { key: 'activationAmount', label: 'Activation Amount', description: 'Activation payment amount', category: 'Activation' },
    { key: 'previousExpireDate', label: 'Previous Expire Date', description: 'Previous expiration date', category: 'Activation' },
    { key: 'nextExpireDate', label: 'Next Expire Date', description: 'New expiration date', category: 'Activation' },
    { key: 'paymentMethod', label: 'Payment Method', description: 'Payment method used', category: 'Activation' },
    { key: 'activationId', label: 'Activation ID', description: 'Activation record ID', category: 'Activation' },
    { key: 'billingActivationId', label: 'Billing Activation ID', description: 'Billing activation record ID', category: 'Activation' },
  ],
};

function getAvailableVariables(triggerType?: string) {
  const vars = [...BUILT_IN_VARIABLES, ...COMMON_CONTEXT_VARIABLES];
  if (triggerType && TRIGGER_SPECIFIC_VARIABLES[triggerType]) {
    vars.push(...TRIGGER_SPECIFIC_VARIABLES[triggerType]);
  }
  return vars;
}

// ── Autocomplete textarea for template variables ──
function TemplateTextarea({
  value,
  onChange,
  rows = 4,
  placeholder,
  className = '',
  triggerType,
}: {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  triggerType?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allVars = getAvailableVariables(triggerType);
  const filtered = filter
    ? allVars.filter(
        (v) =>
          v.key.toLowerCase().includes(filter.toLowerCase()) ||
          v.label.toLowerCase().includes(filter.toLowerCase())
      )
    : allVars;

  // Detect {{ and show suggestions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newVal.slice(0, cursorPos);
    const match = textBeforeCursor.match(/\{\{([a-zA-Z0-9_]*)$/);

    if (match) {
      setFilter(match[1]);
      setShowSuggestions(true);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    // Find the {{ before cursor
    const match = textBeforeCursor.match(/\{\{([a-zA-Z0-9_]*)$/);
    if (match) {
      const start = cursorPos - match[0].length;
      const newValue = value.slice(0, start) + `{{${variable}}}` + textAfterCursor;
      onChange(newValue);

      // Set cursor after the inserted variable
      requestAnimationFrame(() => {
        const newCursorPos = start + variable.length + 4; // {{ + var + }}
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      });
    }

    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertVariable(filtered[selectedIndex].key);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        className={className}
        placeholder={placeholder}
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
          {filtered.map((v, i) => (
            <button
              key={v.key}
              type="button"
              className={`w-full text-left px-2.5 py-1.5 text-xs flex items-start gap-2 hover:bg-blue-50 ${
                i === selectedIndex ? 'bg-blue-50' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertVariable(v.key);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <code className="text-blue-600 font-mono shrink-0 bg-blue-50 px-1 rounded">{`{{${v.key}}}`}</code>
              <span className="text-gray-500 truncate">{v.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Template input for single-line fields (URL) ──
function TemplateInput({
  value,
  onChange,
  placeholder,
  className = '',
  triggerType,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  triggerType?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allVars = getAvailableVariables(triggerType);
  const filtered = filter
    ? allVars.filter(
        (v) =>
          v.key.toLowerCase().includes(filter.toLowerCase()) ||
          v.label.toLowerCase().includes(filter.toLowerCase())
      )
    : allVars;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = newVal.slice(0, cursorPos);
    const match = textBeforeCursor.match(/\{\{([a-zA-Z0-9_]*)$/);

    if (match) {
      setFilter(match[1]);
      setShowSuggestions(true);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    const match = textBeforeCursor.match(/\{\{([a-zA-Z0-9_]*)$/);
    if (match) {
      const start = cursorPos - match[0].length;
      const newValue = value.slice(0, start) + `{{${variable}}}` + textAfterCursor;
      onChange(newValue);

      requestAnimationFrame(() => {
        const newCursorPos = start + variable.length + 4;
        input.setSelectionRange(newCursorPos, newCursorPos);
        input.focus();
      });
    }

    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertVariable(filtered[selectedIndex].key);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
          {filtered.map((v, i) => (
            <button
              key={v.key}
              type="button"
              className={`w-full text-left px-2.5 py-1.5 text-xs flex items-start gap-2 hover:bg-blue-50 ${
                i === selectedIndex ? 'bg-blue-50' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                insertVariable(v.key);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <code className="text-blue-600 font-mono shrink-0 bg-blue-50 px-1 rounded">{`{{${v.key}}}`}</code>
              <span className="text-gray-500 truncate">{v.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkflowDesigner() {
  const { automationId } = useParams<{ automationId: string }>();
  const isLoadingFromServer = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showExecutionHistory, setShowExecutionHistory] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<{
    show: boolean;
    item: any;
  }>({ show: false, item: null });

  // Test execution state
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testTriggerType, setTestTriggerType] = useState('user-created');
  const [testUsername, setTestUsername] = useState('test_user');
  const [testEmail, setTestEmail] = useState('test@example.com');
  const [testResult, setTestResult] = useState<TestAutomationResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Find the trigger type connected to the selected node (traverse edges backwards)
  const getConnectedTriggerType = useCallback((): string | undefined => {
    if (!selectedNode) return undefined;
    const visited = new Set<string>();
    const queue = [selectedNode.id];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = nodes.find((n) => n.id === nodeId);
      if (node?.type === 'trigger' && node.data?.triggerType) {
        return node.data.triggerType as string;
      }
      // Find edges pointing to this node and trace back to their source
      for (const edge of edges) {
        if (edge.target === nodeId && !visited.has(edge.source)) {
          queue.push(edge.source);
        }
      }
    }
    return undefined;
  }, [selectedNode, nodes, edges]);

  // Load history from backend
  const { data: history = [], refetch: refetchHistory, isError: historyError, error: historyErrorData } = useQuery({
    queryKey: ['workflowHistory', automationId],
    queryFn: async () => {
      console.log('Fetching history for automation:', automationId);
      const data = await workflowHistoryApi.getHistoryByAutomation(parseInt(automationId!), 50);
      console.log('History loaded:', data);
      return data;
    },
    enabled: !!automationId && showHistory,
  });

  // Refetch history when panel opens
  React.useEffect(() => {
    if (showHistory) {
      console.log('History panel opened, refetching...');
      refetchHistory();
    }
  }, [showHistory, refetchHistory]);

  // Log history errors
  React.useEffect(() => {
    if (historyError) {
      console.error('History query error:', historyErrorData);
    }
  }, [historyError, historyErrorData]);

  const { data: automation, isLoading } = useQuery({
    queryKey: ['automation', automationId],
    queryFn: () => getAutomationById(parseInt(automationId!)),
    enabled: !!automationId,
  });

  // Load workflow when automation data changes
  React.useEffect(() => {
    if (automation?.workflowJson) {
      try {
        isLoadingFromServer.current = true;
        const workflow = JSON.parse(automation.workflowJson);
        console.log('Loading workflow from backend:', workflow);
        
        if (workflow.nodes && Array.isArray(workflow.nodes)) {
          setNodes(workflow.nodes);
        }
        if (workflow.edges && Array.isArray(workflow.edges)) {
          setEdges(workflow.edges);
        }
        
        // Restore viewport if saved and reactFlowInstance is ready
        if (workflow.viewport && reactFlowInstance) {
          setTimeout(() => {
            reactFlowInstance.setViewport(workflow.viewport);
          }, 100);
        }
        
        // Reset loading flag after a short delay
        setTimeout(() => {
          isLoadingFromServer.current = false;
        }, 200);
      } catch (error) {
        console.error('Error parsing workflow JSON:', error);
      }
    }
  }, [automation, reactFlowInstance, setNodes, setEdges]);

  // Mutation to save history to backend
  const saveHistoryMutation = useMutation({
    mutationFn: (data: { workflowJson: string; nodeCount: number; edgeCount: number }) => {
      console.log('Saving to history:', data);
      return workflowHistoryApi.createHistory({
        automationId: parseInt(automationId!),
        ...data,
      });
    },
    onSuccess: (data) => {
      console.log('History saved successfully:', data);
      refetchHistory();
    },
    onError: (error) => {
      console.error('Error saving history:', error);
    },
  });

  // Auto-save to history when nodes or edges change
  React.useEffect(() => {
    if ((nodes.length > 0 || edges.length > 0) && automation && !isLoadingFromServer.current) {
      const timer = setTimeout(() => {
        console.log('Auto-saving history after 2s debounce');
        const workflowJson = JSON.stringify({ nodes, edges });
        saveHistoryMutation.mutate({
          workflowJson,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        });
      }, 2000); // Debounce 2 seconds for backend saves
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, automation]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const workflowJson = JSON.stringify({ 
        nodes, 
        edges,
        viewport: reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 }
      });
      
      console.log('Saving workflow with data:', { 
        nodeCount: nodes.length, 
        edgeCount: edges.length,
        workflowJson 
      });
      
      return updateAutomation(parseInt(automationId!), {
        title: automation!.title,
        description: automation!.description,
        icon: automation!.icon,
        color: automation!.color,
        status: automation!.status,
        isActive: automation!.isActive,
        workflowJson,
      });
    },
    onSuccess: (data) => {
      console.log('Workflow saved successfully:', data);
      toast.success('Workflow saved successfully');
    },
    onError: (error) => {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow');
    },
  });

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: any) => {
    // Don't show configuration panel for comment nodes
    if (node.type !== 'comment') {
      setSelectedNode(node);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    // Hide configuration panel when clicking on empty canvas
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const nodeData = JSON.parse(event.dataTransfer.getData('application/nodedata'));

      if (typeof type === 'undefined' || !type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: any = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: nodeData,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onDragStart = (event: DragEvent, nodeType: string, nodeData: any) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/nodedata', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';

    // Create a custom drag image from just the dragged item element
    // This prevents the browser from capturing the entire sidebar/menu as the drag preview
    const dragElement = event.currentTarget as HTMLElement;
    const clone = dragElement.cloneNode(true) as HTMLElement;
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.width = `${dragElement.offsetWidth}px`;
    clone.style.opacity = '0.85';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);

    const rect = dragElement.getBoundingClientRect();
    event.dataTransfer.setDragImage(clone, event.clientX - rect.left, event.clientY - rect.top);

    // Remove the clone after the browser has captured it
    requestAnimationFrame(() => {
      document.body.removeChild(clone);
    });
  };

  const handleSave = () => {
    console.log('Save button clicked. Current state:', { 
      nodeCount: nodes.length, 
      edgeCount: edges.length,
      nodes,
      edges 
    });
    saveMutation.mutate();
  };

  const handleTest = () => {
    // Auto-detect trigger type from workflow nodes
    const triggerNodes = nodes.filter(n => n.type === 'trigger');
    if (triggerNodes.length > 0 && triggerNodes[0].data?.triggerType) {
      setTestTriggerType(triggerNodes[0].data.triggerType);
    }
    setTestResult(null);
    setTestError(null);
    setShowTestDialog(true);
  };

  const testMutation = useMutation({
    mutationFn: () => testAutomation(parseInt(automationId!), {
      triggerType: testTriggerType,
      username: testUsername,
      email: testEmail,
      context: {
        username: testUsername,
        email: testEmail,
        phone: '0000000000',
        enabled: true,
        balance: 100.00,
      },
    }),
    onSuccess: (data) => {
      setTestResult(data);
      setTestError(null);
      if (data.status === 'completed') {
        toast.success(`Test passed — ${data.actionsSucceeded}/${data.actionsExecuted} actions succeeded in ${data.executionTimeMs}ms`);
      } else if (data.status === 'completed_with_errors') {
        toast.warning(`Test completed with errors — ${data.actionsFailed} action(s) failed`);
      } else {
        toast.error(`Test failed: ${data.errorMessage || 'Unknown error'}`);
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || 'Test failed';
      setTestError(msg);
      setTestResult(null);
      toast.error(msg);
    },
  });

  const restoreFromHistory = useCallback((historyItem: any) => {
    setRestoreConfirm({ show: true, item: historyItem });
  }, []);

  const confirmRestore = useCallback(() => {
    if (restoreConfirm.item) {
      try {
        const workflow = JSON.parse(restoreConfirm.item.workflowJson);
        setNodes(workflow.nodes || []);
        setEdges(workflow.edges || []);
        setShowHistory(false);
        setRestoreConfirm({ show: false, item: null });
        toast.success('Workflow restored from history');
      } catch (error) {
        console.error('Error parsing workflow JSON:', error);
        toast.error('Failed to restore workflow');
      }
    }
  }, [restoreConfirm.item, setNodes, setEdges]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col">
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Skeleton */}
          <div className="w-56 bg-white border-r flex flex-col overflow-hidden">
            <div className="px-2 py-1.5 border-b">
              <div className="h-4 bg-gray-200 rounded w-24 mb-1 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
              {/* Skeleton for node types */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="h-3 bg-gray-200 rounded w-16 mb-2 animate-pulse"></div>
                  <div className="space-y-1.5">
                    {[1, 2].map((j) => (
                      <div key={j} className="border border-gray-200 rounded p-2 animate-pulse">
                        <div className="flex items-start gap-2">
                          <div className="h-5 w-5 bg-gray-200 rounded shrink-0"></div>
                          <div className="flex-1">
                            <div className="h-3 bg-gray-200 rounded w-20 mb-1"></div>
                            <div className="h-2 bg-gray-200 rounded w-full"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas Skeleton */}
          <div className="flex-1 bg-gray-50 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
                <div className="text-sm text-gray-600 font-medium">Loading workflow...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 bg-white border-r flex flex-col overflow-hidden">
          <div className="px-2 py-1.5 border-b">
            <h2 className="font-semibold text-sm">Nodes Library</h2>
            <p className="text-xs text-muted-foreground">Drag to canvas</p>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
            {/* Triggers Section — filtered by automation triggerType */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                Triggers
              </h3>
              <div className="space-y-1.5">
                {(automation?.triggerType === 'scheduled'
                  ? SCHEDULED_TRIGGERS
                  : automation?.triggerType === 'on_requested'
                    ? MANUAL_TRIGGERS
                    : ON_ACTION_TRIGGERS
                ).map((trigger) => {
                  const Icon = trigger.icon;
                  return (
                  <div
                    key={trigger.value}
                    draggable
                    onDragStart={(e) =>
                      onDragStart(e, 'trigger', {
                        label: trigger.label,
                        description: trigger.description,
                        triggerType: trigger.value,
                      })
                    }
                    className="border border-blue-200 bg-blue-50 rounded p-2 cursor-move hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-blue-900">{trigger.label}</div>
                        <div className="text-xs text-blue-600 line-clamp-1">{trigger.description}</div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {/* Actions Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                Actions
              </h3>
              <div className="space-y-1.5">
                {ACTION_TYPES.map((action) => {
                  const Icon = action.icon;
                  return (
                  <div
                    key={action.value}
                    draggable
                    onDragStart={(e) =>
                      onDragStart(e, 'action', {
                        label: action.label,
                        description: action.description,
                        actionType: action.value,
                      })
                    }
                    className="border border-green-200 bg-green-50 rounded p-2 cursor-move hover:border-green-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-green-900">{action.label}</div>
                        <div className="text-xs text-green-600 line-clamp-1">{action.description}</div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {/* Conditions Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                Conditions
              </h3>
              <div className="space-y-1.5">
                {CONDITION_TYPES.map((condition) => {
                  const Icon = condition.icon;
                  return (
                  <div
                    key={condition.value}
                    draggable
                    onDragStart={(e) =>
                      onDragStart(e, 'condition', {
                        label: condition.label,
                        description: condition.description,
                        conditionType: condition.value,
                      })
                    }
                    className="border border-yellow-200 bg-yellow-50 rounded p-2 cursor-move hover:border-yellow-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-yellow-900">{condition.label}</div>
                        <div className="text-xs text-yellow-600 line-clamp-1">{condition.description}</div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

            {/* Comments Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
                Comments
              </h3>
              <div className="space-y-1.5">
                {COMMENT_TYPES.map((comment) => {
                  const Icon = comment.icon;
                  return (
                  <div
                    key={comment.value}
                    draggable
                    onDragStart={(e) =>
                      onDragStart(e, 'comment', {
                        label: comment.label,
                        text: comment.description,
                        commentType: comment.value,
                      })
                    }
                    className="border border-gray-300 bg-gray-50 rounded p-2 cursor-move hover:border-gray-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="h-5 w-5 text-gray-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-gray-900">{comment.label}</div>
                        <div className="text-xs text-gray-600 line-clamp-1">{comment.description}</div>
                      </div>
                    </div>
                  </div>
                )})}              </div>
            </div>
          </div>

          <div className="px-2 py-1.5 border-t bg-gray-50">
            <h3 className="font-semibold text-xs mb-1.5">Quick Tips</h3>
            <ul className="text-xs space-y-0.5 text-muted-foreground">
              <li>🎯 Drag nodes to canvas</li>
              <li>🔗 Connect nodes via handles</li>
              <li>⌫ Delete: Select + Delete key</li>
              <li>💾 Auto-save on changes</li>
            </ul>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-gray-50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.2}
            maxZoom={2}
            fitView={false}
            className="bg-gray-50"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls className="bg-white border shadow-lg" />
            <MiniMap 
              className="bg-white border shadow-lg"
              nodeColor={(node) => {
                if (node.type === 'trigger') return '#3b82f6';
                if (node.type === 'action') return '#10b981';
                if (node.type === 'condition') return '#eab308';
                return '#6b7280';
              }}
            />
            <Panel position="top-right" className="bg-white p-3 rounded-lg shadow-lg border">
              <div className="text-xs space-y-1">
                <div className="font-semibold">Workflow Stats</div>
                <div className="text-muted-foreground">
                  Nodes: <span className="font-medium text-foreground">{nodes.length}</span>
                </div>
                <div className="text-muted-foreground">
                  Connections: <span className="font-medium text-foreground">{edges.length}</span>
                </div>
              </div>
            </Panel>
          </ReactFlow>
          
          {/* Node Configuration Panel - Right Sidebar */}
          {selectedNode && (
            <div className="absolute right-0 top-0 bottom-0 w-64 bg-white border-l shadow-lg z-40 flex flex-col">
              <div className="px-2 py-1.5 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Node Settings</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Type</label>
                  <div className="text-xs capitalize px-3 py-2 bg-gray-100 rounded font-medium">{selectedNode.type}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Label</label>
                  <input
                    type="text"
                    value={selectedNode.data.label || ''}
                    onChange={(e) => {
                      const updatedNodes = nodes.map(node => 
                        node.id === selectedNode.id 
                          ? { ...node, data: { ...node.data, label: e.target.value } }
                          : node
                      );
                      setNodes(updatedNodes);
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, label: e.target.value } });
                    }}
                    className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter label..."
                  />
                </div>
                {selectedNode.type === 'comment' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">Comment Text</label>
                    <textarea
                      value={selectedNode.data.text || ''}
                      onChange={(e) => {
                        const updatedNodes = nodes.map(node => 
                          node.id === selectedNode.id 
                            ? { ...node, data: { ...node.data, text: e.target.value } }
                            : node
                        );
                        setNodes(updatedNodes);
                        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, text: e.target.value } });
                      }}
                      rows={4}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter comment text..."
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Description</label>
                  <textarea
                    value={selectedNode.data.description || ''}
                    onChange={(e) => {
                      const updatedNodes = nodes.map(node => 
                        node.id === selectedNode.id 
                          ? { ...node, data: { ...node.data, description: e.target.value } }
                          : node
                      );
                      setNodes(updatedNodes);
                      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, description: e.target.value } });
                    }}
                    rows={3}
                    className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter description..."
                  />
                </div>
                {/* HTTP Request Configuration */}
                {selectedNode.type === 'action' && selectedNode.data.actionType === 'http-request' && (
                  <>
                    <div className="pt-1 border-t">
                      <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" /> HTTP Request Config
                      </h4>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">Method</label>
                      <select
                        value={selectedNode.data.httpMethod || 'GET'}
                        onChange={(e) => {
                          const updatedNodes = nodes.map(node => 
                            node.id === selectedNode.id 
                              ? { ...node, data: { ...node.data, httpMethod: e.target.value } }
                              : node
                          );
                          setNodes(updatedNodes);
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, httpMethod: e.target.value } });
                        }}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">URL</label>
                      <TemplateInput
                        value={selectedNode.data.httpUrl || ''}
                        onChange={(val) => {
                          const updatedNodes = nodes.map(node => 
                            node.id === selectedNode.id 
                              ? { ...node, data: { ...node.data, httpUrl: val } }
                              : node
                          );
                          setNodes(updatedNodes);
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, httpUrl: val } });
                        }}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                        placeholder="https://api.example.com/webhook"
                        triggerType={getConnectedTriggerType()}
                      />
                      <p className="text-xs text-gray-400 mt-0.5">Type <code className="bg-gray-100 px-0.5 rounded">{'{{'}</code> to see available variables</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">Headers (JSON)</label>
                      <TemplateTextarea
                        value={selectedNode.data.httpHeaders || ''}
                        onChange={(val) => {
                          const updatedNodes = nodes.map(node => 
                            node.id === selectedNode.id 
                              ? { ...node, data: { ...node.data, httpHeaders: val } }
                              : node
                          );
                          setNodes(updatedNodes);
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, httpHeaders: val } });
                        }}
                        rows={3}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                        placeholder={'{"Authorization": "Bearer {{token}}"}'}
                        triggerType={getConnectedTriggerType()}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">Body</label>
                      <TemplateTextarea
                        value={selectedNode.data.httpBody || ''}
                        onChange={(val) => {
                          const updatedNodes = nodes.map(node => 
                            node.id === selectedNode.id 
                              ? { ...node, data: { ...node.data, httpBody: val } }
                              : node
                          );
                          setNodes(updatedNodes);
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, httpBody: val } });
                        }}
                        rows={4}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                        placeholder={'{"username": "{{username}}"}'}
                        triggerType={getConnectedTriggerType()}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">Content Type</label>
                      <select
                        value={selectedNode.data.httpContentType || 'application/json'}
                        onChange={(e) => {
                          const updatedNodes = nodes.map(node => 
                            node.id === selectedNode.id 
                              ? { ...node, data: { ...node.data, httpContentType: e.target.value } }
                              : node
                          );
                          setNodes(updatedNodes);
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, httpContentType: e.target.value } });
                        }}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="application/json">application/json</option>
                        <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                        <option value="text/plain">text/plain</option>
                        <option value="text/xml">text/xml</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">Expected Status Codes</label>
                      <input
                        type="text"
                        value={selectedNode.data.httpExpectedStatusCodes || '200-299'}
                        onChange={(e) => {
                          const updatedNodes = nodes.map(node => 
                            node.id === selectedNode.id 
                              ? { ...node, data: { ...node.data, httpExpectedStatusCodes: e.target.value } }
                              : node
                          );
                          setNodes(updatedNodes);
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, httpExpectedStatusCodes: e.target.value } });
                        }}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="200-299"
                      />
                      <p className="text-xs text-gray-400 mt-0.5">e.g., 200-299 or 200,201,204</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block mb-1.5">Timeout (seconds)</label>
                      <input
                        type="number"
                        value={selectedNode.data.httpTimeoutSeconds || 30}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 30;
                          const updatedNodes = nodes.map(node => 
                            node.id === selectedNode.id 
                              ? { ...node, data: { ...node.data, httpTimeoutSeconds: val } }
                              : node
                          );
                          setNodes(updatedNodes);
                          setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, httpTimeoutSeconds: val } });
                        }}
                        min={1}
                        max={120}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="px-3 py-3 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setNodes(nodes.filter(node => node.id !== selectedNode.id));
                    setSelectedNode(null);
                  }}
                  className="w-full px-3 py-2 bg-red-50 text-red-600 rounded text-xs font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Node
                </button>
              </div>
            </div>
          )}
          
          {/* History Panel */}
          {showHistory && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l shadow-xl z-50 flex flex-col">
              <div className="px-2 py-1.5 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Version History
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {history.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No history yet. Make changes to save versions.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => restoreFromHistory(item)}
                        className="w-full text-left p-3 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-700">
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </span>
                          <RotateCcw className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-600" />
                        </div>
                        <div className="text-xs text-gray-600">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex gap-3 mt-2 text-xs">
                          <span className="text-blue-600">{item.nodeCount} nodes</span>
                          <span className="text-green-600">{item.edgeCount} connections</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* History Toggle Button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="absolute top-4 left-60 z-40 bg-white border shadow-md hover:shadow-lg p-2.5 rounded-lg transition-all hover:bg-gray-50"
            title="Version History"
          >
            <History className="h-4 w-4 text-gray-700" />
          </button>
          
          {/* Execution History Toggle Button */}
          <button
            onClick={() => setShowExecutionHistory(!showExecutionHistory)}
            className="absolute top-4 left-72 z-40 bg-white border shadow-md hover:shadow-lg p-2.5 rounded-lg transition-all hover:bg-gray-50"
            title="Execution History"
          >
            <Activity className="h-4 w-4 text-gray-700" />
          </button>
          
          {/* Execution History Panel */}
          {showExecutionHistory && automation?.uuid && (
            <ExecutionHistoryPanel
              automationUuid={automation.uuid}
              onClose={() => setShowExecutionHistory(false)}
            />
          )}
          
          {/* Loading Indicator */}
          {(isLoading || saveMutation.isPending) && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
              <div className="bg-white/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-gray-200 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {isLoading ? 'Loading workflow...' : 'Saving...'}
                </span>
              </div>
            </div>
          )}
          
          {/* Floating Action Buttons */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-row gap-2 z-50">
            <Button 
              variant="outline" 
              onClick={handleTest} 
              size="sm"
              className="shadow-md hover:shadow-lg transition-all bg-white rounded-full h-10 w-10 p-0"
              aria-label="Test"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button 
              onClick={handleSave} 
              size="sm"
              type="button"
              disabled={saveMutation.isPending}
              className="shadow-md hover:shadow-lg transition-all rounded-full h-10 w-10 p-0"
              aria-label="Save"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreConfirm.show} onOpenChange={(open) => !open && setRestoreConfirm({ show: false, item: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Workflow Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current workflow with the selected version from history.
              {restoreConfirm.item && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1">
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(restoreConfirm.item.createdAt).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-600">
                    {restoreConfirm.item.nodeCount} nodes, {restoreConfirm.item.edgeCount} connections
                  </div>
                </div>
              )}
              <div className="mt-3 text-amber-600 font-medium">
                Any unsaved changes will be lost.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>Restore Version</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Automation Dialog */}
      {showTestDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl border w-[520px] max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-100 rounded-lg">
                  <Play className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Test Automation</h3>
                  <p className="text-xs text-muted-foreground">Run the workflow with sample data</p>
                </div>
              </div>
              <button onClick={() => setShowTestDialog(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Config section — hide when results are showing */}
              {!testResult && !testMutation.isPending && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">Trigger Type</label>
                    <select
                      value={testTriggerType}
                      onChange={(e) => setTestTriggerType(e.target.value)}
                      className="w-full h-9 px-3 rounded-md border text-sm bg-white"
                    >
                      {TRIGGER_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">Test Username</label>
                      <input
                        type="text"
                        value={testUsername}
                        onChange={(e) => setTestUsername(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border text-sm"
                        placeholder="test_user"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">Test Email</label>
                      <input
                        type="text"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="w-full h-9 px-3 rounded-md border text-sm"
                        placeholder="test@example.com"
                      />
                    </div>
                  </div>

                  {testError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{testError}</span>
                    </div>
                  )}
                </>
              )}

              {/* Loading state */}
              {testMutation.isPending && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm text-gray-600 font-medium">Running test...</p>
                  <p className="text-xs text-gray-400">Executing workflow nodes</p>
                </div>
              )}

              {/* Results */}
              {testResult && (
                <div className="space-y-3">
                  {/* Status Banner */}
                  <div className={`p-3 rounded-lg border flex items-center gap-3 ${
                    testResult.status === 'completed' ? 'bg-green-50 border-green-200' :
                    testResult.status === 'completed_with_errors' ? 'bg-amber-50 border-amber-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    {testResult.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    ) : testResult.status === 'completed_with_errors' ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        testResult.status === 'completed' ? 'text-green-800' :
                        testResult.status === 'completed_with_errors' ? 'text-amber-800' :
                        'text-red-800'
                      }`}>
                        {testResult.status === 'completed' ? 'Test Passed' :
                         testResult.status === 'completed_with_errors' ? 'Completed with Errors' :
                         'Test Failed'}
                      </p>
                      {testResult.resultSummary && (
                        <p className="text-xs text-gray-600 mt-0.5">{testResult.resultSummary}</p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Nodes', value: testResult.nodesVisited },
                      { label: 'Actions', value: testResult.actionsExecuted },
                      { label: 'Passed', value: testResult.actionsSucceeded },
                      { label: 'Time', value: `${testResult.executionTimeMs}ms` },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center px-2 py-2 rounded-lg bg-gray-50 border">
                        <div className="text-sm font-semibold text-gray-900">{stat.value}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Error message */}
                  {testResult.errorMessage && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-mono whitespace-pre-wrap">
                      {testResult.errorMessage}
                    </div>
                  )}

                  {/* Steps */}
                  {testResult.steps && testResult.steps.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Execution Steps</h4>
                      <div className="space-y-1">
                        {testResult.steps.map((step: TestStepResult) => (
                          <div
                            key={step.stepOrder}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-xs"
                          >
                            <span className="text-gray-400 font-mono w-5 shrink-0">#{step.stepOrder}</span>
                            {step.status === 'completed' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            ) : step.status === 'failed' ? (
                              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            ) : step.status === 'condition_true' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : step.status === 'condition_false' ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-800">
                                {step.nodeLabel || step.nodeSubType || step.nodeType}
                              </span>
                              {step.httpMethod && step.httpUrl && (
                                <span className="ml-1.5 text-gray-400">
                                  {step.httpMethod} {step.httpUrl.length > 30 ? step.httpUrl.substring(0, 30) + '...' : step.httpUrl}
                                </span>
                              )}
                              {step.httpResponseStatusCode && (
                                <span className={`ml-1 px-1 py-0.5 rounded text-[10px] font-mono ${
                                  step.httpResponseStatusCode < 400 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {step.httpResponseStatusCode}
                                </span>
                              )}
                            </div>
                            <span className="text-gray-400 shrink-0">{step.executionTimeMs}ms</span>
                            {step.result && (
                              <span className="text-gray-500 truncate max-w-[100px]" title={step.result}>
                                {step.result}
                              </span>
                            )}
                            {step.errorMessage && (
                              <span className="text-red-500 truncate max-w-[120px]" title={step.errorMessage}>
                                {step.errorMessage}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t flex items-center justify-between bg-gray-50/50 rounded-b-xl">
              <button
                onClick={() => setShowTestDialog(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
              <div className="flex gap-2">
                {testResult && (
                  <button
                    onClick={() => { setTestResult(null); setTestError(null); }}
                    className="px-3 py-1.5 text-xs rounded-md border bg-white hover:bg-gray-50 text-gray-700 font-medium"
                  >
                    Configure
                  </button>
                )}
                <button
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                  className="px-4 py-1.5 text-xs rounded-md bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {testResult ? 'Run Again' : 'Run Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
