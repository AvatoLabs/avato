import {
  KnowledgeBaseApiName,
  KnowledgeBaseIdentifier,
} from '@lobechat/builtin-tool-knowledge-base';
import { describe, expect, it, vi } from 'vitest';

import { ToolExecutionService } from './index';

describe('ToolExecutionService', () => {
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

  it('should allow larger default output for knowledge base read tool results', async () => {
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
        apiName: KnowledgeBaseApiName.readKnowledge,
        arguments: '{"fileIds":["file-1"]}',
        id: 'tool-call-2',
        identifier: KnowledgeBaseIdentifier,
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
