export type DeviceGatewayConnectionStatus =
  | 'authenticating'
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'reconnecting';

export interface DeviceGatewayConfig {
  allowRemoteTools?: boolean;
  deviceId?: string;
  enabled?: boolean;
  gatewayProxyUrl?: string;
  gatewayUrl?: string;
}

export interface DeviceGatewayStatus {
  allowRemoteTools: boolean;
  connectionStatus: DeviceGatewayConnectionStatus;
  deviceId?: string;
  enabled: boolean;
  gatewayProxyUrl?: string;
  gatewayUrl?: string;
  lastConnectedAt?: string;
  lastError?: string;
  userId?: string;
}

export interface DeviceGatewayResult {
  error?: string;
  status: DeviceGatewayStatus;
  success: boolean;
}
