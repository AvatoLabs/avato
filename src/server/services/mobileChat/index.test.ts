import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as MechaModule from '@/server/modules/Mecha';

import { buildMobileToolExecutionContext, MobileChatService } from './index';

const findBySessionIdMock = vi.hoisted(() => vi.fn());
const findByIdOrSlugMock = vi.hoisted(() => vi.fn());
const getSessionAssignedFileContentsMock = vi.hoisted(() => vi.fn());
const findAccessibleSpaceByIdMock = vi.hoisted(() => vi.fn());
const pluginQueryMock = vi.hoisted(() => vi.fn());
const pluginUpdateMock = vi.hoisted(() => vi.fn());
const deviceProxyMock = vi.hoisted(() => ({
  isConfigured: false,
  queryDeviceList: vi.fn(),
  queryDeviceSystemInfo: vi.fn(),
}));

vi.mock('@/database/models/agent', () => ({
  AgentModel: class AgentModel {
    findBySessionId = findBySessionIdMock;
  },
}));

vi.mock('@/database/models/file', () => ({
  FileModel: class FileModel {
    getSessionAssignedFileContents = getSessionAssignedFileContentsMock;
  },
}));

vi.mock('@/database/models/plugin', () => ({
  PluginModel: class PluginModel {
    query = pluginQueryMock;
    update = pluginUpdateMock;
  },
}));

vi.mock('@/database/models/session', () => ({
  SessionModel: class SessionModel {
    findByIdOrSlug = findByIdOrSlugMock;
  },
}));

vi.mock('@/database/models/space', () => ({
  SpaceModel: class SpaceModel {
    findAccessibleSpaceById = findAccessibleSpaceByIdMock;
  },
}));

vi.mock('@/server/modules/ModelRuntime', () => ({
  createTraceOptions: vi.fn(() => ({})),
}));

vi.mock('@/server/services/search', () => ({
  SearchService: class SearchService {},
}));

vi.mock('@/server/services/toolExecution/deviceProxy', () => ({
  deviceProxy: deviceProxyMock,
}));

describe('MobileChatService', () => {
  beforeEach(() => {
    findBySessionIdMock.mockReset();
    findByIdOrSlugMock.mockReset();
    getSessionAssignedFileContentsMock.mockReset();
    findAccessibleSpaceByIdMock.mockReset();
    pluginQueryMock.mockReset();
    pluginQueryMock.mockResolvedValue([]);
    pluginUpdateMock.mockReset();
    deviceProxyMock.isConfigured = false;
    deviceProxyMock.queryDeviceList.mockReset();
    deviceProxyMock.queryDeviceSystemInfo.mockReset();
  });

  it('should inject conversation-scoped files for session chats without agent config', async () => {
    findBySessionIdMock.mockResolvedValue(undefined);
    findByIdOrSlugMock.mockResolvedValue(undefined);

    const conversationFileContents = [
      {
        content: 'Conversation scoped note',
        fileId: 'file-1',
        filename: 'notes.md',
      },
    ];

    getSessionAssignedFileContentsMock.mockResolvedValue(conversationFileContents);

    const serverMessagesEngineSpy = vi
      .spyOn(MechaModule, 'serverMessagesEngine')
      .mockResolvedValue([{ content: 'hello', role: 'user' } as any]);

    const modelRuntime = {
      chat: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: 'done', role: 'assistant' } }],
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    };

    const service = new MobileChatService({
      modelRuntime: modelRuntime as any,
      provider: 'openai',
      requestSignal: new AbortController().signal,
      serverDB: {} as any,
      userId: 'user-1',
    });

    const response = await service.handleChat({
      messages: [{ content: 'hi', role: 'user' } as any],
      model: 'gpt-4o',
      sessionId: 'session-1',
      stream: false,
    } as any);

    expect(serverMessagesEngineSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledge: expect.objectContaining({
          conversationFileContents,
        }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      choices: [{ finish_reason: 'stop', message: { content: 'done', role: 'assistant' } }],
    });
  });

  it('should reject inaccessible payload spaceId before running chat flow', async () => {
    findAccessibleSpaceByIdMock.mockResolvedValue(undefined);

    const service = new MobileChatService({
      modelRuntime: { chat: vi.fn() } as any,
      provider: 'openai',
      requestSignal: new AbortController().signal,
      serverDB: {} as any,
      userId: 'user-1',
    });

    await expect(
      service.handleChat({
        messages: [{ content: 'hi', role: 'user' } as any],
        model: 'gpt-4o',
        spaceId: 'spc_blocked',
        stream: false,
      } as any),
    ).rejects.toThrow('SPACE_ACCESS_DENIED');
  });

  it('should build remote desktop execution context for mobile tool calls', () => {
    const context = buildMobileToolExecutionContext({
      activeDeviceId: 'device-1',
      operationId: 'operation-1',
      serverDB: {} as any,
      spaceId: 'space-1',
      toolCall: {
        apiName: 'runCommand',
        arguments: '{}',
        id: 'tool-call-1',
        identifier: 'lobe-local-system',
        type: 'builtin',
      } as any,
      toolManifestMap: {},
      topicId: 'topic-1',
      userId: 'user-1',
    });

    expect(context.activeDeviceId).toBe('device-1');
    expect(context.operationId).toBe('operation-1');
    expect(context.messageId).toBe('tool-call-1');
    expect(context.spaceId).toBe('space-1');
    expect(context.topicId).toBe('topic-1');
    expect(context.userId).toBe('user-1');
  });

  it('should expose Remote Device and Local System tools when one eligible desktop is online', async () => {
    deviceProxyMock.isConfigured = true;
    deviceProxyMock.queryDeviceList.mockResolvedValue([
      {
        allowRemoteComputerUse: false,
        allowRemoteTools: true,
        deviceId: 'device-1',
        hostname: 'Mac Studio',
        lastSeen: new Date(0).toISOString(),
        online: true,
        platform: 'darwin',
      },
    ]);
    deviceProxyMock.queryDeviceSystemInfo.mockResolvedValue({
      arch: 'arm64',
      desktopPath: '/Users/test/Desktop',
      documentsPath: '/Users/test/Documents',
      downloadsPath: '/Users/test/Downloads',
      homePath: '/Users/test',
      musicPath: '/Users/test/Music',
      picturesPath: '/Users/test/Pictures',
      userDataPath: '/Users/test/Library/Application Support',
      videosPath: '/Users/test/Movies',
      workingDirectory: '/Users/test',
    });
    pluginQueryMock.mockResolvedValue([]);

    const service = new MobileChatService({
      modelRuntime: { chat: vi.fn() } as any,
      provider: 'openai',
      requestSignal: new AbortController().signal,
      serverDB: {} as any,
      userId: 'user-1',
    });

    const deviceContext = await (service as any).resolveDeviceContext();
    const toolSet = await (service as any).resolveToolSet({
      conversationConfig: undefined,
      deviceContext,
      payload: {
        messages: [{ content: 'hi', role: 'user' }],
        model: 'gpt-4o',
        stream: true,
      },
      pluginIds: [],
      skillMetas: [],
    });

    expect(deviceContext.activeDeviceId).toBe('device-1');
    expect(deviceContext.deviceSystemInfo).toMatchObject({
      platform: 'darwin',
      workingDirectory: '/Users/test',
    });
    expect(toolSet.enabledToolIds).toEqual(
      expect.arrayContaining(['lobe-remote-device', 'lobe-local-system']),
    );
    expect(toolSet.enabledToolIds).not.toContain('avato-computer-use');
    expect(toolSet.manifestMap['lobe-remote-device'].systemRole).toContain('Mac Studio');
  });

  it('should expose Computer Use only when the active desktop allows it', async () => {
    deviceProxyMock.isConfigured = true;
    deviceProxyMock.queryDeviceList.mockResolvedValue([
      {
        allowRemoteComputerUse: true,
        allowRemoteTools: true,
        deviceId: 'device-1',
        hostname: 'Mac Studio',
        lastSeen: new Date(0).toISOString(),
        online: true,
        platform: 'darwin',
      },
    ]);
    deviceProxyMock.queryDeviceSystemInfo.mockResolvedValue(undefined);
    pluginQueryMock.mockResolvedValue([]);

    const service = new MobileChatService({
      modelRuntime: { chat: vi.fn() } as any,
      provider: 'openai',
      requestSignal: new AbortController().signal,
      serverDB: {} as any,
      userId: 'user-1',
    });

    const deviceContext = await (service as any).resolveDeviceContext();
    const toolSet = await (service as any).resolveToolSet({
      conversationConfig: undefined,
      deviceContext,
      payload: {
        messages: [{ content: 'hi', role: 'user' }],
        model: 'gpt-4o',
        stream: true,
      },
      pluginIds: [],
      skillMetas: [],
    });

    expect(deviceContext.activeDeviceComputerUseReady).toBe(true);
    expect(toolSet.enabledToolIds).toEqual(
      expect.arrayContaining(['avato-computer-use', 'lobe-local-system']),
    );
  });

  it('should activate Local System tools after a Remote Device activation result', () => {
    const service = new MobileChatService({
      modelRuntime: { chat: vi.fn() } as any,
      provider: 'openai',
      requestSignal: new AbortController().signal,
      serverDB: {} as any,
      userId: 'user-1',
    });

    const activation = (service as any).applyDeviceActivation({
      executionState: { metadata: { activeDeviceId: 'device-2' } },
      toolCall: {
        apiName: 'activateDevice',
        arguments: '{"deviceId":"device-2"}',
        id: 'tool-call-2',
        identifier: 'lobe-remote-device',
        type: 'builtin',
      },
      toolSet: {
        enabledToolIds: ['lobe-remote-device'],
        manifestMap: {
          'lobe-remote-device': {
            api: [],
            identifier: 'lobe-remote-device',
            type: 'builtin',
          },
        },
        sourceMap: { 'lobe-remote-device': 'builtin' },
        tools: [],
      },
    });

    expect(activation.activeDeviceId).toBe('device-2');
    expect(activation.toolSet.enabledToolIds).toContain('lobe-local-system');
    expect(activation.toolSet.manifestMap['lobe-local-system']).toBeDefined();
    expect(activation.toolSet.manifestMap['avato-computer-use']).toBeUndefined();
    expect(activation.toolSet.sourceMap['lobe-local-system']).toBe('builtin');
    expect(activation.toolSet.tools.length).toBeGreaterThan(0);
  });
});
