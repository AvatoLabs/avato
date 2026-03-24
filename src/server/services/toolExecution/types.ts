import { type LobeToolManifest } from '@lobechat/context-engine';
import { type LobeChatDatabase } from '@lobechat/database';
import { type ChatToolPayload } from '@lobechat/types';

import { type ProcessContentBlocksFn } from '@/server/services/mcp/contentProcessor';

export interface ToolExecutionContext {
  /** Target device ID for device proxy tool calls */
  activeDeviceId?: string;
  /** Knowledge base IDs enabled for the current agent/session */
  knowledgeBaseIds?: string[];
  /** Memory tool permission from agent chat config */
  memoryToolPermission?: 'read-only' | 'read-write';
  /** Optional MCP content block post-processor for multimodal tool results */
  processContentBlocks?: ProcessContentBlocksFn;
  /** Server database for LobeHub Skills execution */
  serverDB?: LobeChatDatabase;
  /** When set, preferred Space for sandbox exports (`createFileRecord` / `space_blobs`); must be user-accessible. */
  spaceId?: string;
  toolManifestMap: Record<string, LobeToolManifest>;
  /**
   * Maximum length for tool execution result content (in characters)
   * @default 6000
   */
  toolResultMaxLength?: number;
  /** Topic ID for sandbox session management */
  topicId?: string;
  userId?: string;
}

export interface ToolExecutionResult {
  content: string;
  error?: any;
  state?: Record<string, any>;
  success: boolean;
}

export interface ToolExecutionResultResponse extends ToolExecutionResult {
  executionTime: number;
}

export interface IToolExecutor {
  execute: (
    payload: ChatToolPayload,
    context: ToolExecutionContext,
  ) => Promise<ToolExecutionResult>;
}
