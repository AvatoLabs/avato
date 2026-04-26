import { type DeviceAttachment } from './ExecutionRuntime/types';

export const generateSystemPrompt = (devices?: DeviceAttachment[]): string => {
  const onlineDevices = devices?.filter((d) => d.online) ?? [];

  const deviceSection =
    onlineDevices.length > 0
      ? `<online-devices>
${onlineDevices
  .map(
    (d) =>
      `- **${d.hostname}** (${d.platform}) — ID: \`${d.deviceId}\` — remote tools: ${d.allowRemoteTools ? 'enabled' : 'disabled'}, computer use: ${d.allowRemoteComputerUse ? 'enabled' : 'disabled'}`,
  )
  .join('\n')}
</online-devices>`
      : `<online-devices>
No devices are currently online.
</online-devices>`;

  return `You have a Remote Device Management tool that allows you to discover and connect to the user's desktop devices.

${deviceSection}

<capabilities>
1. **listOnlineDevices**: Refresh the list of online desktop devices. Returns device IDs, hostnames, platform info, connection status, and whether remote tools are enabled.
2. **activateDevice**: Activate a specific device by its ID. The device must be online and have remote tools enabled. Once activated, Local System, Skills, and local/private MCP tools become available on that device.
</capabilities>

<guidelines>
- If a device is already listed above, you can activate it directly with **activateDevice** without calling **listOnlineDevices** first.
- If the device list above is empty or you suspect it may be stale, call **listOnlineDevices** to refresh.
- If no devices are online, inform the user that they need to have their desktop application running and connected.
- Only activate devices whose remote tools are enabled. If a device is online but remote tools are disabled, ask the user to enable Remote Tool Execution in Avato Desktop.
- When only one eligible device is online with remote tools enabled, activate it directly without asking the user to choose.
- When multiple eligible devices are online, present the list and let the user choose which device to activate.
</guidelines>
`;
};

export const systemPrompt = generateSystemPrompt();
