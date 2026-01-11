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
import { CommentNode } from '../components/workflow/CommentNode';
import { Button } from '../components/ui/button';
import { 
  ChevronRight, 
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
  MessageSquare
} from 'lucide-react';
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
  comment: CommentNode,
};

const TRIGGER_TYPES = [
  { value: 'user-created', label: 'User Created', description: 'When a new user is created', icon: UserPlus },
  { value: 'user-updated', label: 'User Updated', description: 'When user profile is updated', icon: UserCog },
  { value: 'user-expired', label: 'User Expired', description: 'When user subscription expires', icon: Clock },
  { value: 'user-churned', label: 'User Churned', description: 'When user stops service', icon: UserX },
  { value: 'payment-received', label: 'Payment Received', description: 'When payment is received', icon: CreditCard },
  { value: 'user-deleted', label: 'User Deleted', description: 'When user is deleted', icon: Trash2 },
];

const ACTION_TYPES = [
  { value: 'send-email', label: 'Send Email', description: 'Send an email notification', icon: Mail },
  { value: 'send-notification', label: 'Send Notification', description: 'Send in-app notification', icon: Bell },
  { value: 'credit-wallet', label: 'Credit Wallet', description: 'Add credits to user wallet', icon: Wallet },
  { value: 'debit-wallet', label: 'Debit Wallet', description: 'Deduct credits from wallet', icon: WalletCards },
  { value: 'suspend-user', label: 'Suspend User', description: 'Suspend user account', icon: UserMinus },
  { value: 'apply-discount', label: 'Apply Discount', description: 'Apply a discount code', icon: Percent },
  { value: 'update-profile', label: 'Update Profile', description: 'Update user profile fields', icon: FileEdit },
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

export default function WorkflowDesigner() {
  const { automationId } = useParams<{ automationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const { data: automation, isLoading } = useQuery({
    queryKey: ['automation', automationId],
    queryFn: () => getAutomationById(parseInt(automationId!)),
    enabled: !!automationId,
  });

  // Load workflow when automation data changes
  React.useEffect(() => {
    if (automation?.workflowJson) {
      try {
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
      } catch (error) {
        console.error('Error parsing workflow JSON:', error);
      }
    }
  }, [automation, reactFlowInstance, setNodes, setEdges]);

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
      queryClient.invalidateQueries({ queryKey: ['automation', automationId] });
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

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setSelectedNode(node);
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
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 bg-white border-r flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b">
            <h2 className="font-semibold text-sm">Nodes Library</h2>
            <p className="text-xs text-muted-foreground">Drag to canvas</p>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {/* Triggers Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                Triggers
              </h3>
              <div className="space-y-1.5">
                {TRIGGER_TYPES.map((trigger) => {
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
                      <Icon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
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
                      <Icon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
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
                      <Icon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
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
                      <Icon className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs text-gray-900">{comment.label}</div>
                        <div className="text-xs text-gray-600 line-clamp-1">{comment.description}</div>
                      </div>
                    </div>
                  </div>
                )})}              </div>
            </div>
          </div>

          <div className="px-3 py-2 border-t bg-gray-50">
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
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">Node Settings</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
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
              className="shadow-md hover:shadow-lg transition-all rounded-full h-10 w-10 p-0"
              aria-label="Save"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
