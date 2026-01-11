import React, { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  MiniMap,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { TriggerNode } from '../components/workflow/TriggerNode';
import { ActionNode } from '../components/workflow/ActionNode';
import { ConditionNode } from '../components/workflow/ConditionNode';
import { Button } from '../components/ui/button';
import { ArrowLeft, Save, Play, Plus } from 'lucide-react';
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
  const [selectedNodeType, setSelectedNodeType] = useState<'trigger' | 'action' | 'condition'>('trigger');
  const [selectedType, setSelectedType] = useState('');

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
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = () => {
    if (!selectedType) {
      toast.error('Please select a node type');
      return;
    }

    const typeConfig = 
      selectedNodeType === 'trigger' ? TRIGGER_TYPES.find(t => t.value === selectedType) :
      selectedNodeType === 'action' ? ACTION_TYPES.find(t => t.value === selectedType) :
      CONDITION_TYPES.find(t => t.value === selectedType);

    if (!typeConfig) return;

    const newNode: Node = {
      id: `${selectedNodeType}-${Date.now()}`,
      type: selectedNodeType,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        label: typeConfig.label,
        description: typeConfig.description,
        [`${selectedNodeType}Type`]: selectedType,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedType('');
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
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/billing/automations')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">{automation?.title}</h1>
            <p className="text-sm text-muted-foreground">Workflow Designer</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest}>
            <Play className="h-4 w-4 mr-2" />
            Test
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r p-4 overflow-y-auto">
          <h2 className="font-bold mb-4">Add Node</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Node Type</Label>
              <Select value={selectedNodeType} onValueChange={(value: any) => {
                setSelectedNodeType(value);
                setSelectedType('');
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trigger">Trigger</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                  <SelectItem value="condition">Condition</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {selectedNodeType === 'trigger' ? 'Trigger Type' :
                 selectedNodeType === 'action' ? 'Action Type' : 'Condition Type'}
              </Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${selectedNodeType}`} />
                </SelectTrigger>
                <SelectContent>
                  {(selectedNodeType === 'trigger' ? TRIGGER_TYPES :
                    selectedNodeType === 'action' ? ACTION_TYPES :
                    CONDITION_TYPES).map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={addNode} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Node
            </Button>
          </div>

          <div className="mt-8">
            <h3 className="font-bold mb-2">Instructions</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>• Drag nodes to position them</li>
              <li>• Connect nodes by dragging from handles</li>
              <li>• Click nodes to configure</li>
              <li>• Delete nodes with Delete key</li>
            </ul>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} />
            <Controls />
            <MiniMap />
            <Panel position="top-right" className="bg-white p-2 rounded shadow text-sm">
              Nodes: {nodes.length} | Edges: {edges.length}
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
