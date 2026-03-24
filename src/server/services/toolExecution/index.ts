import {
  KnowledgeBaseApiName,
  KnowledgeBaseIdentifier,
} from '@lobechat/builtin-tool-knowledge-base';
import { type ChatToolPayload } from '@lobechat/types';
import { safeParseJSON } from '@lobechat/utils';
import debug from 'debug';

import { type CloudMCPParams, type ToolCallContent } from '@/libs/mcp';
import { contentBlocksToString } from '@/server/services/mcp/contentProcessor';
import {
  DEFAULT_TOOL_RESULT_MAX_LENGTH,
  truncateToolResult,
} from '@/server/utils/truncateToolResult';

import { DiscoverService } from '../discover';
import { type MCPService } from '../mcp';
import { type PluginGatewayService } from '../pluginGateway';
import { type BuiltinToolsExecutor } from './builtin';
import {
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolExecutionResultResponse,
} from './types';

const log = debug('lobe-server:tool-execution-service');
const MAX_MCP_RETRIES = 3;
const KNOWLEDGE_BASE_READ_TOOL_RESULT_MAX_LENGTH = 100_000;

interface ToolExecutionServiceDeps {
  builtinToolsExecutor: BuiltinToolsExecutor;
  mcpService: MCPService;
  pluginGatewayService: PluginGatewayService;
}

export class ToolExecutionService {
  private builtinToolsExecutor: BuiltinToolsExecutor;
  private mcpService: MCPService;
  private pluginGatewayService: PluginGatewayService;

  constructor({
    mcpService,
    pluginGatewayService,
    builtinToolsExecutor,
  }: ToolExecutionServiceDeps) {
    this.builtinToolsExecutor = builtinToolsExecutor;
    this.mcpService = mcpService;
    this.pluginGatewayService = pluginGatewayService;
  }

  async executeTool(
    payload: ChatToolPayload,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResultResponse> {
    const { identifier, apiName, type } = payload;

    log('Executing tool: %s:%s (type: %s)', identifier, apiName, type);

    const startTime = Date.now();
    try {
      const typeStr = type as string;
      let data: ToolExecutionResult;
      switch (typeStr) {
        case 'builtin': {
          data = await this.builtinToolsExecutor.execute(payload, context);
          break;
        }

        case 'mcp': {
          data = await this.executeMCPTool(payload, context);
          break;
        }

        default: {
          data = await this.pluginGatewayService.execute(payload, context);

          break;
        }
      }

      const executionTime = Date.now() - startTime;
      const toolResultMaxLength = this.getToolResultMaxLength(payload, context);

      // Truncate result content to prevent context overflow
      // Use agent-specific config if provided, otherwise use default
      const truncatedContent = truncateToolResult(data.content, toolResultMaxLength);

      // Log if content was truncated
      if (truncatedContent !== data.content) {
        const maxLength = toolResultMaxLength ?? DEFAULT_TOOL_RESULT_MAX_LENGTH;
        log(
          'Tool result truncated for %s:%s - original: %d chars, truncated: %d chars (limit: %d)',
          identifier,
          apiName,
          data.content.length,
          truncatedContent.length,
          maxLength,
        );
      }

      return {
        ...data,
        content: truncatedContent,
        executionTime,
      };

      // Handle MCP and other types (default, standalone, markdown, mcp)
    } catch (error) {
      const executionTime = Date.now() - startTime;
      log('Error executing tool %s:%s: %O', identifier, apiName, error);
      const errorMessage = (error as Error).message;

      return {
        content: truncateToolResult(errorMessage),
        error: {
          message: errorMessage,
        },
        executionTime,
        success: false,
      };
    }
  }

  private getToolResultMaxLength = (payload: ChatToolPayload, context: ToolExecutionContext) => {
    if (context.toolResultMaxLength !== undefined) return context.toolResultMaxLength;

    if (
      payload.identifier === KnowledgeBaseIdentifier &&
      payload.apiName === KnowledgeBaseApiName.readKnowledge
    ) {
      return KNOWLEDGE_BASE_READ_TOOL_RESULT_MAX_LENGTH;
    }

    return undefined;
  };

  private async executeMCPTool(
    payload: ChatToolPayload,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const { identifier, apiName, arguments: args } = payload;

    log('Executing MCP tool: %s:%s', identifier, apiName);

    // Get the manifest from context
    const manifest = context.toolManifestMap[identifier];
    if (!manifest) {
      log('Manifest not found for MCP tool: %s', identifier);
      return {
        content: `Manifest not found for tool: ${identifier}`,
        error: {
          code: 'MANIFEST_NOT_FOUND',
          message: `Manifest not found for tool: ${identifier}`,
        },
        success: false,
      };
    }

    // Extract MCP params from manifest (stored in customParams.mcp in LobeTool)
    const mcpParams = (manifest as any).mcpParams;
    if (!mcpParams) {
      log('MCP configuration not found in manifest for: %s ', identifier);
      return {
        content: `MCP configuration not found for tool: ${identifier}, please tell user TRY TO REINSTALL THE MCP PLUGIN`,
        error: {
          code: 'MCP_CONFIG_NOT_FOUND',
          message: `MCP configuration not found for tool: ${identifier}`,
        },
        success: false,
      };
    }

    log(
      'Calling MCP service with params for: %s:%s (type: %s)',
      identifier,
      apiName,
      mcpParams.type,
    );

    try {
      // Check if this is a cloud MCP endpoint
      if (mcpParams.type === 'cloud') {
        return await this.executeCloudMCPTool(payload, context, mcpParams);
      }

      for (let attempt = 1; attempt <= MAX_MCP_RETRIES; attempt += 1) {
        try {
          const result = await this.mcpService.callTool({
            argsStr: args,
            clientParams: mcpParams,
            processContentBlocks: context.processContentBlocks,
            toolName: apiName,
          });

          log('MCP tool execution successful for: %s:%s', identifier, apiName);

          return {
            content: typeof result === 'string' ? result : result.content,
            state: typeof result === 'object' ? result.state : undefined,
            success: true,
          };
        } catch (error) {
          const errorMessage = (error as Error).message;
          const isRetryable =
            errorMessage.includes('NoValidSessionId') ||
            errorMessage.includes('Server not initialized');

          if (isRetryable && attempt < MAX_MCP_RETRIES) {
            log(
              'Retrying MCP tool %s:%s after retryable session error (attempt %d/%d)',
              identifier,
              apiName,
              attempt,
              MAX_MCP_RETRIES,
            );
            continue;
          }

          throw error;
        }
      }

      throw new Error(`MCP tool execution exceeded ${MAX_MCP_RETRIES} retries`);
    } catch (error) {
      log('MCP tool execution failed for %s:%s: %O', identifier, apiName, error);
      return {
        content: (error as Error).message,
        error: {
          code: 'MCP_EXECUTION_ERROR',
          message: (error as Error).message,
        },
        success: false,
      };
    }
  }

  private async executeCloudMCPTool(
    payload: ChatToolPayload,
    context: ToolExecutionContext,

    _mcpParams: CloudMCPParams,
  ): Promise<ToolExecutionResult> {
    const { identifier, apiName, arguments: args } = payload;

    log('Executing Cloud MCP tool: %s:%s via cloud gateway', identifier, apiName);

    try {
      // Create DiscoverService with user context
      const discoverService = new DiscoverService({
        userInfo: context.userId ? { userId: context.userId } : undefined,
      });

      // Parse arguments
      const apiParams = safeParseJSON(args) || {};

      // Call cloud MCP endpoint via Market API
      // Returns CloudGatewayResponse: { content: ToolCallContent[], isError?: boolean }
      const cloudResult = await discoverService.callCloudMcpEndpoint({
        apiParams,
        identifier,
        toolName: apiName,
      });

      const cloudResultContent = (cloudResult?.content ?? []) as ToolCallContent[];

      // Convert content blocks to string (same as market router does)
      const content = contentBlocksToString(cloudResultContent);
      const state = { ...cloudResult, content: cloudResultContent };

      log('Cloud MCP tool execution successful for: %s:%s', identifier, apiName);

      return {
        content,
        state,
        success: !cloudResult?.isError,
      };
    } catch (error) {
      log('Cloud MCP tool execution failed for %s:%s: %O', identifier, apiName, error);
      return {
        content: (error as Error).message,
        error: {
          code: 'CLOUD_MCP_EXECUTION_ERROR',
          message: (error as Error).message,
        },
        success: false,
      };
    }
  }
}

export * from './types';
