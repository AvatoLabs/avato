import { type BuiltinToolManifest } from '@lobechat/types';

import { systemPrompt } from './systemRole';
import { RemoteDeviceApiName, RemoteDeviceIdentifier } from './types';

export const RemoteDeviceManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'List all online desktop devices belonging to the current user. Returns device IDs, hostnames, platform, connection status, and whether Remote Tool Execution is enabled.',
      name: RemoteDeviceApiName.listOnlineDevices,
      parameters: {
        properties: {},
        type: 'object',
      },
    },
    {
      description:
        'Activate a specific desktop device by its ID. The device must be online and have Remote Tool Execution enabled in LobeHub Desktop. Once activated, Local System, Skills, and local/private MCP tools can run on that device.',
      name: RemoteDeviceApiName.activateDevice,
      parameters: {
        properties: {
          deviceId: {
            description: 'The unique identifier of the device to activate',
            type: 'string',
          },
        },
        required: ['deviceId'],
        type: 'object',
      },
    },
  ],
  humanIntervention: 'never',
  identifier: RemoteDeviceIdentifier,
  meta: {
    avatar: '🖥️',
    description:
      'Discover remote desktop devices and activate devices that allow remote tool execution',
    readme:
      'Manage connections to your desktop devices. List online devices, check whether Remote Tool Execution is enabled, and activate an authorized device for remote operations.',
    title: 'Remote Device',
  },
  systemRole: systemPrompt,
  type: 'builtin',
};
