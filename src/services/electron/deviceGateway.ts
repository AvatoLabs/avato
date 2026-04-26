import type {
  DeviceGatewayConfig,
  DeviceGatewayResult,
  DeviceGatewayStatus,
} from '@lobechat/electron-client-ipc';

import { ensureElectronIpc } from '@/utils/electron/ipc';

class DesktopDeviceGatewayService {
  async getAgentStatus(): Promise<DeviceGatewayStatus> {
    return ensureElectronIpc().deviceGateway.getAgentStatus();
  }

  async setAgentConfig(config: DeviceGatewayConfig): Promise<DeviceGatewayResult> {
    return ensureElectronIpc().deviceGateway.setAgentConfig(config);
  }

  async startAgent(config?: DeviceGatewayConfig): Promise<DeviceGatewayResult> {
    return ensureElectronIpc().deviceGateway.startAgent(config);
  }

  async stopAgent(): Promise<DeviceGatewayResult> {
    return ensureElectronIpc().deviceGateway.stopAgent();
  }
}

export const desktopDeviceGatewayService = new DesktopDeviceGatewayService();
