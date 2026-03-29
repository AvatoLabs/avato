import type { BuiltinStreaming } from '@lobechat/types';

/**
 * Docs Agent streaming component registry
 *
 * Streaming components are used to render tool calls while arguments
 * are still being generated, allowing real-time feedback to users.
 */
export const DocsAgentStreamings: Record<string, BuiltinStreaming> = {};
