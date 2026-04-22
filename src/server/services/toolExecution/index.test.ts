import { SourceSetApiName, SourceSetIdentifier } from '@lobechat/builtin-tool-source-set';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToolExecutionService } from './index';

const { executeToolCallMock } = vi.hoisted(() => ({
  executeToolCallMock: vi.fn(),
}));

vi.mock('./deviceProxy', () => ({
  deviceProxy: {
    executeToolCall: executeToolCallMock,
  },
}));

describe('ToolExecutionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry retryable MCP session errors and return processed content', async () => {
    const builtinToolsExecutor = {
      execute: vi.fn(),
    } as any;
    const mcpService = {
      callTool: vi
        .fn()
        .mockRejectedValueOnce(new Error('NoValidSessionId'))
        .mockResolvedValueOnce({
          content: '42',
          state: { answer: 42 },
          success: true,
        }),
    } as any;
    const pluginGatewayService = {
      execute: vi.fn(),
    } as any;

    const service = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService,
    });

    const processContentBlocks = vi.fn();
    const result = await service.executeTool(
      {
        apiName: 'calculate',
        arguments: '{"expression":"6*7"}',
        id: 'tool-call-1',
        identifier: 'demo-mcp',
        type: 'mcp',
      } as any,
      {
        processContentBlocks,
        toolManifestMap: {
          'demo-mcp': {
            api: [],
            identifier: 'demo-mcp',
            mcpParams: {
              type: 'http',
              url: 'https://example.com/mcp',
            },
            meta: { title: 'Demo MCP' },
            type: 'mcp',
          } as any,
        },
      },
    );

    expect(result.success).toBe(true);
    expect(result.content).toBe('42');
    expect(result.state).toEqual({ answer: 42 });
    expect(mcpService.callTool).toHaveBeenCalledTimes(2);
    expect(mcpService.callTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        processContentBlocks,
        toolName: 'calculate',
      }),
    );
  });

  it('should execute stdio MCP tools through the active desktop device', async () => {
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({
        content: 'desktop mcp result',
        state: { content: [{ text: 'desktop mcp result', type: 'text' }] },
        success: true,
      }),
      success: true,
    });

    const builtinToolsExecutor = {
      execute: vi.fn(),
    } as any;
    const mcpService = {
      callTool: vi.fn(),
    } as any;
    const pluginGatewayService = {
      execute: vi.fn(),
    } as any;

    const service = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService,
    });

    const result = await service.executeTool(
      {
        apiName: 'search',
        arguments: '{"query":"hello"}',
        id: 'tool-call-desktop-mcp',
        identifier: 'desktop-mcp',
        type: 'mcp',
      } as any,
      {
        activeDeviceId: 'device-1',
        toolManifestMap: {
          'desktop-mcp': {
            api: [],
            identifier: 'desktop-mcp',
            mcpParams: {
              args: ['@demo/mcp-server'],
              command: 'npx',
              env: { TOKEN: 'secret' },
              name: 'desktop-mcp',
              type: 'stdio',
            },
            meta: { title: 'Desktop MCP' },
            type: 'mcp',
          } as any,
        },
        userId: 'user-1',
      },
    );

    expect(result.success).toBe(true);
    expect(result.content).toBe('desktop mcp result');
    expect(result.state).toEqual({
      content: [{ text: 'desktop mcp result', type: 'text' }],
    });
    expect(mcpService.callTool).not.toHaveBeenCalled();
    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      expect.objectContaining({
        apiName: 'callTool',
        identifier: 'lobe-mcp',
      }),
      120_000,
    );

    const [, toolCall] = executeToolCallMock.mock.calls[0];
    expect(JSON.parse(toolCall.arguments)).toEqual({
      args: '{"query":"hello"}',
      params: {
        args: ['@demo/mcp-server'],
        command: 'npx',
        env: { TOKEN: 'secret' },
        name: 'desktop-mcp',
        type: 'stdio',
      },
      toolName: 'search',
    });
  });

  it('should require an active desktop device for stdio MCP tools', async () => {
    const builtinToolsExecutor = {
      execute: vi.fn(),
    } as any;
    const mcpService = {
      callTool: vi.fn(),
    } as any;
    const pluginGatewayService = {
      execute: vi.fn(),
    } as any;

    const service = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService,
    });

    const result = await service.executeTool(
      {
        apiName: 'search',
        arguments: '{}',
        id: 'tool-call-no-device',
        identifier: 'desktop-mcp',
        type: 'mcp',
      } as any,
      {
        toolManifestMap: {
          'desktop-mcp': {
            api: [],
            identifier: 'desktop-mcp',
            mcpParams: {
              command: 'npx',
              name: 'desktop-mcp',
              type: 'stdio',
            },
            meta: { title: 'Desktop MCP' },
            type: 'mcp',
          } as any,
        },
        userId: 'user-1',
      },
    );

    expect(result).toMatchObject({
      error: {
        code: 'MCP_DESKTOP_DEVICE_REQUIRED',
      },
      success: false,
    });
    expect(result.content).toContain('No active desktop device selected');
    expect(executeToolCallMock).not.toHaveBeenCalled();
    expect(mcpService.callTool).not.toHaveBeenCalled();
  });

  it('should execute local HTTP MCP tools through the active desktop device', async () => {
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({
        content: 'local http result',
        success: true,
      }),
      success: true,
    });

    const builtinToolsExecutor = {
      execute: vi.fn(),
    } as any;
    const mcpService = {
      callTool: vi.fn(),
    } as any;
    const pluginGatewayService = {
      execute: vi.fn(),
    } as any;

    const service = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService,
    });

    const result = await service.executeTool(
      {
        apiName: 'readLocal',
        arguments: '{"path":"/tmp/a.txt"}',
        id: 'tool-call-local-http',
        identifier: 'local-http-mcp',
        type: 'mcp',
      } as any,
      {
        activeDeviceId: 'device-1',
        toolManifestMap: {
          'local-http-mcp': {
            api: [],
            identifier: 'local-http-mcp',
            mcpParams: {
              name: 'local-http-mcp',
              type: 'http',
              url: 'http://localhost:8787/mcp',
            },
            meta: { title: 'Local HTTP MCP' },
            type: 'mcp',
          } as any,
        },
        userId: 'user-1',
      },
    );

    expect(result.success).toBe(true);
    expect(result.content).toBe('local http result');
    expect(mcpService.callTool).not.toHaveBeenCalled();
    expect(executeToolCallMock).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      expect.objectContaining({
        apiName: 'callTool',
        identifier: 'lobe-mcp',
      }),
      120_000,
    );
  });

  it('should not route non-http private-looking MCP urls through the desktop device', async () => {
    const builtinToolsExecutor = {
      execute: vi.fn(),
    } as any;
    const mcpService = {
      callTool: vi.fn().mockResolvedValue('direct mcp result'),
    } as any;
    const pluginGatewayService = {
      execute: vi.fn(),
    } as any;

    const service = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService,
    });

    const result = await service.executeTool(
      {
        apiName: 'readLocal',
        arguments: '{}',
        id: 'tool-call-ftp-http-mcp',
        identifier: 'ftp-http-mcp',
        type: 'mcp',
      } as any,
      {
        activeDeviceId: 'device-1',
        toolManifestMap: {
          'ftp-http-mcp': {
            api: [],
            identifier: 'ftp-http-mcp',
            mcpParams: {
              name: 'ftp-http-mcp',
              type: 'http',
              url: 'ftp://127.0.0.1/mcp',
            },
            meta: { title: 'FTP HTTP MCP' },
            type: 'mcp',
          } as any,
        },
        userId: 'user-1',
      },
    );

    expect(result).toMatchObject({
      content: 'direct mcp result',
      success: true,
    });
    expect(mcpService.callTool).toHaveBeenCalledTimes(1);
    expect(executeToolCallMock).not.toHaveBeenCalled();
  });

  it('should treat desktop MCP payloads with an error as failed when success is omitted', async () => {
    executeToolCallMock.mockResolvedValue({
      content: JSON.stringify({
        content: 'desktop mcp failed',
        error: {
          code: 'MCP_TOOL_FAILED',
          message: 'Tool failed',
        },
      }),
      success: true,
    });

    const builtinToolsExecutor = {
      execute: vi.fn(),
    } as any;
    const mcpService = {
      callTool: vi.fn(),
    } as any;
    const pluginGatewayService = {
      execute: vi.fn(),
    } as any;

    const service = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService,
    });

    const result = await service.executeTool(
      {
        apiName: 'search',
        arguments: '{"query":"hello"}',
        id: 'tool-call-desktop-mcp-error',
        identifier: 'desktop-mcp',
        type: 'mcp',
      } as any,
      {
        activeDeviceId: 'device-1',
        toolManifestMap: {
          'desktop-mcp': {
            api: [],
            identifier: 'desktop-mcp',
            mcpParams: {
              command: 'npx',
              name: 'desktop-mcp',
              type: 'stdio',
            },
            meta: { title: 'Desktop MCP' },
            type: 'mcp',
          } as any,
        },
        userId: 'user-1',
      },
    );

    expect(result).toMatchObject({
      content: 'desktop mcp failed',
      error: {
        code: 'MCP_TOOL_FAILED',
        message: 'Tool failed',
      },
      success: false,
    });
  });

  it('should allow larger default output for source set read tool results', async () => {
    const content = 'a'.repeat(30_000);
    const builtinToolsExecutor = {
      execute: vi.fn().mockResolvedValue({
        content,
        success: true,
      }),
    } as any;
    const mcpService = {
      callTool: vi.fn(),
    } as any;
    const pluginGatewayService = {
      execute: vi.fn(),
    } as any;

    const service = new ToolExecutionService({
      builtinToolsExecutor,
      mcpService,
      pluginGatewayService,
    });

    const result = await service.executeTool(
      {
        apiName: SourceSetApiName.readSourceFiles,
        arguments: '{"fileIds":["file-1"]}',
        id: 'tool-call-2',
        identifier: SourceSetIdentifier,
        type: 'builtin',
      } as any,
      {
        toolManifestMap: {},
      },
    );

    expect(result.success).toBe(true);
    expect(result.content).toBe(content);
  });
});
