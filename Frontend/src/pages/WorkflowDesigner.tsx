import React, { useCallback, useState, DragEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TriggerNode } from '../components/workflow/TriggerNode';
import { ActionNode } from '../components/workflow/ActionNode';
import { ConditionNode } from '../components/workflow/ConditionNode';
import { Button } from '../components/ui/button';
import { ChevronRight, Save, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAutomationById, updateAutomation } from '../api/automations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Label } from '../components/ui/label';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

const TRIGGER_TYPES = [
  { value: 'user-created', label: 'User Created', description: 'When a new user is created' },
  { value: 'user-updated', label: 'User Updated', description: 'When user profile is updated' },
  { value: 'user-expired', label: 'User Expired', description: 'When user subscription expires' },
  { value: 'user-churned', label: 'User Churned', description: 'When user stops service' },
  { value: 'payment-received', label: 'Payment Received', description: 'When payment is received' },
  { value: 'user-deleted', label: 'User Deleted', description: 'When user is deleted' },
];

const ACTION_TYPES = [
  { value: 'send-email', label: 'Send Email', description: 'Send an email notification' },
  { value: 'send-notification', label: 'Send Notification', description: 'Send in-app notification' },
  { value: 'credit-wallet', label: 'Credit Wallet', description: 'Add credits to user wallet' },
  { value: 'debit-wallet', label: 'Debit Wallet', description: 'Deduct credits from wallet' },
  { value: 'suspend-user', label: 'Suspend User', description: 'Suspend user account' },
  { value: 'apply-discount', label: 'Apply Discount', description: 'Apply a discount code' },
  { value: 'update-profile', label: 'Update Profile', description: 'Update user profile fields' },
];

const CONDITION_TYPES = [
  { value: 'balance-check', label: 'Check Balance', description: 'Check if balance meets condition' },
  { value: 'user-status', label: 'User Status', description: 'Check user status' },
  { value: 'date-check', label: 'Date Check', description: 'Check date conditions' },
];

export default function WorkflowDesigner() {
  const { automationId } = useParams<{ automationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const { data: automation, isLoading } = useQuery({
    queryKey: ['automation', automationId],
    queryFn: () => getAutomationById(parseInt(automationId!)),
    enabled: !!automationId,
    onSuccess: (data) => {
      if (data.workflowJson) {
        try {
          const workflow = JSON.parse(data.workflowJson);
          setNodes(workflow.nodes || []);
          setEdges(workflow.edges || []);
        } catch (error) {
          console.error('Error parsing workflow JSON:', error);
        }
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const workflowJson = JSON.stringify({ nodes, edges });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation', automationId] });
      toast.success('Workflow saved successfully');
    },
    onError: () => {
      toast.error('Failed to save workflow');
    },
  });

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

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
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleTest = () => {
    toast.info('Workflow testing will be implemented');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-1.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-1.5 text-sm">
          <button
            onClick={() => navigate('/billing/automations')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Billing
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => navigate('/billing/automations')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Automations
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Workflow Designer</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} size="sm" className="h-7 text-xs">
            <Play className="h-3 w-3 mr-1.5" />
            Test
          </Button>
          <Button onClick={handleSave} size="sm" className="h-7 text-xs">
            <Save className="h-3 w-3 mr-1.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 bg-white border-r flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-bold text-lg">Nodes Library</h2>
            <p className="text-xs text-muted-foreground mt-1">Drag and drop to canvas</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Triggers Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                Triggers
              </h3>
              <div className="space-y-2">
                {TRIGGER_TYPES.map((trigger) => (
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
                    className="border-2 border-blue-200 bg-blue-50 rounded-lg p-3 cursor-move hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    <div className="font-medium text-sm text-blue-900">{trigger.label}</div>
                    <div className="text-xs text-blue-600 mt-1">{trigger.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Actions
              </h3>
              <div className="space-y-2">
                {ACTION_TYPES.map((action) => (
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
                    className="border-2 border-green-200 bg-green-50 rounded-lg p-3 cursor-move hover:border-green-400 hover:shadow-md transition-all"
                  >
                    <div className="font-medium text-sm text-green-900">{action.label}</div>
                    <div className="text-xs text-green-600 mt-1">{action.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Conditions Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                Conditions
              </h3>
              <div className="space-y-2">
                {CONDITION_TYPES.map((condition) => (
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
                    className="border-2 border-yellow-200 bg-yellow-50 rounded-lg p-3 cursor-move hover:border-yellow-400 hover:shadow-md transition-all"
                  >
                    <div className="font-medium text-sm text-yellow-900">{condition.label}</div>
                    <div className="text-xs text-yellow-600 mt-1">{condition.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50">
            <h3 className="font-semibold text-sm mb-2">Quick Tips</h3>
            <ul className="text-xs space-y-1 text-muted-foreground">
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
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
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
        </div>
      </div>
    </div>
  );
}
