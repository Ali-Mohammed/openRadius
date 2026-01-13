import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { appConfig } from '@/config/app.config';

export enum SyncStatus {
  Starting = 0,
  Authenticating = 1,
  SyncingProfiles = 2,
  FetchingProfilePage = 3,
  ProcessingProfiles = 4,
  SyncingUsers = 5,
  FetchingUserPage = 6,
  ProcessingUsers = 7,
  Completed = 8,
  Failed = 9,
  Cancelled = 10
}

export enum SyncPhase {
  NotStarted = 0,
  Profiles = 1,
  Groups = 2,
  Zones = 3,
  Users = 4,
  Completed = 5
}

export interface SyncProgressUpdate {
  syncId: string;
  integrationId: number;
  integrationName: string;
  workspaceId: number;
  status: SyncStatus;
  currentPhase: SyncPhase;
  profileCurrentPage: number;
  profileTotalPages: number;
  profileTotalRecords: number;
  profileProcessedRecords: number;
  profileNewRecords: number;
  profileUpdatedRecords: number;
  profileFailedRecords: number;
  groupCurrentPage: number;
  groupTotalPages: number;
  groupTotalRecords: number;
  groupProcessedRecords: number;
  groupNewRecords: number;
  groupUpdatedRecords: number;
  groupFailedRecords: number;
  zoneTotalRecords: number;
  zoneProcessedRecords: number;
  zoneNewRecords: number;
  zoneUpdatedRecords: number;
  zoneFailedRecords: number;
  userCurrentPage: number;
  userTotalPages: number;
  userTotalRecords: number;
  userProcessedRecords: number;
  userNewRecords: number;
  userUpdatedRecords: number;
  userFailedRecords: number;
  progressPercentage: number;
  currentMessage?: string;
  errorMessage?: string;
  timestamp: string;
}

export const useSyncHub = (syncId?: string) => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<SyncProgressUpdate | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${appConfig.api.baseUrl}/hubs/sassync`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connectionRef.current = newConnection;
    setConnection(newConnection);

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!connection || !syncId) return;

    const startConnection = async () => {
      try {
        if (connection.state === signalR.HubConnectionState.Disconnected) {
          await connection.start();
          console.log('SignalR Connected');
          setIsConnected(true);

          // Join sync session
          await connection.invoke('JoinSyncSession', syncId);
          console.log(`Joined sync session: ${syncId}`);
        }
      } catch (err) {
        console.error('SignalR Connection Error:', err);
        setIsConnected(false);
        // Retry connection after 5 seconds
        setTimeout(() => startConnection(), 5000);
      }
    };

    // Set up event handlers
    connection.on('SyncProgress', (update: SyncProgressUpdate) => {
      console.log('Sync Progress Update:', update);
      setProgress(update);
    });

    connection.on('JoinedSyncSession', (id: string) => {
      console.log(`Successfully joined sync session: ${id}`);
    });

    connection.onclose(() => {
      console.log('SignalR Disconnected');
      setIsConnected(false);
    });

    connection.onreconnecting(() => {
      console.log('SignalR Reconnecting...');
      setIsConnected(false);
    });

    connection.onreconnected(() => {
      console.log('SignalR Reconnected');
      setIsConnected(true);
      // Rejoin sync session after reconnection
      connection.invoke('JoinSyncSession', syncId);
    });

    startConnection();

    return () => {
      if (connection.state === signalR.HubConnectionState.Connected && syncId) {
        connection.invoke('LeaveSyncSession', syncId).catch(console.error);
      }
    };
  }, [connection, syncId]);

  const leaveSession = useCallback(async () => {
    if (connection && syncId && connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke('LeaveSyncSession', syncId);
    }
  }, [connection, syncId]);

  return {
    connection,
    isConnected,
    progress,
    leaveSession
  };
};

