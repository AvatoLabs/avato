import type { DeviceGatewayStatus } from '../types';

export interface DeviceGatewayBroadcastEvents {
  deviceGatewayStatusChanged: (params: DeviceGatewayStatus) => void;
}
