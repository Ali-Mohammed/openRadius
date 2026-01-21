import { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, ShieldAlert, ShieldCheck, Clock, Trash2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface MicroserviceApproval {
  id: number;
  serviceName: string;
  machineId: string;
  machineName: string;
  platform: string;
  approvalToken: string;
  isApproved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  isRevoked: boolean;
  revokedAt?: string;
  lastConnectedAt: string;
}

export default function MicroserviceApprovals() {
  const [pendingApprovals, setPendingApprovals] = useState<MicroserviceApproval[]>([]);
  const [approvedConnections, setApprovedConnections] = useState<MicroserviceApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<number | null>(null);
  const [approverName, setApproverName] = useState('');

  const loadApprovals = async () => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
      console.log('SignalR not connected, skipping load');
      return;
    }

    try {
      setLoading(true);
      
      const pending = await conn.invoke('GetPendingApprovals');
      const approved = await conn.invoke('GetApprovedConnections');
      
      setPendingApprovals(pending || []);
      setApprovedConnections(approved || []);
    } catch (error) {
      console.error('Failed to load approvals:', error);
      toast.error('Failed to load microservice approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId: number, approverNameParam: string) => {
    const conn = connectionRef.current;
    if (!conn) {
      toast.error('Not connected to server');
      return;
    }

    try {
      const result = await conn.invoke('ApproveConnection', approvalId, approverNameParam);
      
      if (result) {
        toast.success(`Microservice connection approved by ${approverNameParam}`, {
          description: 'The microservice will connect automatically when it restarts.'
        });
        await loadApprovals();
      } else {
        toast.error('Failed to approve connection');
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error('Failed to approve connection');
    }
  };

  const handleRevoke = async (approvalId: number, approverNameParam: string) => {
    const conn = connectionRef.current;
    if (!conn) {
      toast.error('Not connected to server');
      return;
    }

    try {
      const result = await conn.invoke('RevokeConnection', approvalId);
      
      if (result) {
        toast.error(`Microservice connection rejected by ${approverNameParam}`);
        await loadApprovals();
      } else {
        toast.error('Failed to reject connection');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error('Failed to reject connection');
    }
  };

  const openConfirmDialog = (action: 'approve' | 'reject', approvalId: number) => {
    setConfirmAction(action);
    setSelectedApprovalId(approvalId);
    setApproverName('');
    setConfirmDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!approverName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (selectedApprovalId === null) return;

    if (confirmAction === 'approve') {
      await handleApprove(selectedApprovalId, approverName);
    } else if (confirmAction === 'reject') {
      await handleRevoke(selectedApprovalId, approverName);
    }

    setConfirmDialogOpen(false);
    setSelectedApprovalId(null);
    setApproverName('');
  };

  // Initialize SignalR connection
  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/microservices`)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connectionRef.current = newConnection;
    setConnection(newConnection);

    return () => {
      if (newConnection.state === signalR.HubConnectionState.Connected) {
        newConnection.invoke('LeaveDashboard').catch(() => {});
        newConnection.stop();
      }
    };
  }, []);

  // Handle connection state changes
  useEffect(() => {
    if (!connection) return;

    const startConnection = async () => {
      try {
        await connection.start();
        console.log('SignalR connected for approvals');
        
        // Join the dashboard group to receive approval updates
        await connection.invoke('JoinDashboard');
        
        // Load approvals after connecting
        await loadApprovals();
        
        toast.success('Connected to approval system');
      } catch (error) {
        console.error('SignalR connection error:', error);
        toast.error('Failed to connect to server');
      }
    };

    // Set up event handlers
    connection.on('PendingApprovalRequest', (data) => {
      console.log('New approval request:', data);
      toast.info('A microservice is requesting approval');
      loadApprovals();
    });

    connection.on('ApprovalUpdated', (data) => {
      console.log('Approval updated:', data);
      loadApprovals();
    });

    connection.onreconnected(() => {
      console.log('SignalR reconnected');
      connection.invoke('JoinDashboard').catch(console.error);
      loadApprovals();
    });

    connection.onclose(() => {
      console.log('SignalR disconnected');
    });

    startConnection();

    return () => {
      connection.off('PendingApprovalRequest');
      connection.off('ApprovalUpdated');
    };
  }, [connection]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const truncateMachineId = (machineId: string) => {
    return `${machineId.substring(0, 8)}...${machineId.substring(machineId.length - 8)}`;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-8 w-8" />
          Microservice Approvals
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage microservice connection approvals and security
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({pendingApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Approved ({approvedConnections.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : pendingApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-50" />
                No pending approval requests
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingApprovals.map((approval) => (
                <Card key={approval.id} className="border-orange-200 dark:border-orange-900">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {approval.serviceName}
                          <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950 border-orange-200">
                            Pending
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Machine: {approval.machineName} ({approval.platform})
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => openConfirmDialog('approve', approval.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => openConfirmDialog('reject', approval.id)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Machine ID:</span>
                        <p className="font-mono text-xs break-all">{truncateMachineId(approval.machineId)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Requested:</span>
                        <p>{formatDate(approval.lastConnectedAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-6">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : approvedConnections.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                No approved connections yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {approvedConnections.map((approval) => (
                <Card key={approval.id} className="border-green-200 dark:border-green-900">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {approval.serviceName}
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950 border-green-200">
                            Approved
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Machine: {approval.machineName} ({approval.platform})
                        </CardDescription>
                      </div>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => openConfirmDialog('reject', approval.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revoke
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Machine ID:</span>
                        <p className="font-mono text-xs break-all">{truncateMachineId(approval.machineId)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Approved By:</span>
                        <p>{approval.approvedBy || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Approved At:</span>
                        <p>{formatDate(approval.approvedAt)}</p>
                      </div>
                      <div className="col-span-3">
                        <span className="text-muted-foreground">Last Connected:</span>
                        <p>{formatDate(approval.lastConnectedAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'approve' ? 'Approve Connection' : 'Reject Connection'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'approve' 
                ? 'Please enter your name to approve this microservice connection.'
                : 'Please enter your name to reject this microservice connection. This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="approverName">Your Name</Label>
              <Input
                id="approverName"
                placeholder="Enter your name"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && approverName.trim()) {
                    handleConfirm();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!approverName.trim()}
              className={confirmAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={confirmAction === 'reject' ? 'destructive' : 'default'}
            >
              {confirmAction === 'approve' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
