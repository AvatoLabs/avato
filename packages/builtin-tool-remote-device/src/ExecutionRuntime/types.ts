export interface DeviceAttachment {
  allowRemoteComputerUse?: boolean;
  allowRemoteTools?: boolean;
  deviceId: string;
  hostname: string;
  lastSeen: string;
  online: boolean;
  platform: string;
}

export interface DeviceSystemInfo {
  arch: string;
  desktopPath: string;
  documentsPath: string;
  downloadsPath: string;
  homePath: string;
  musicPath: string;
  picturesPath: string;
  userDataPath: string;
  videosPath: string;
  workingDirectory: string;
}
