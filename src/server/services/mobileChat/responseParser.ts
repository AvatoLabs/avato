import { parseSSEChunks } from '@lobechat/fetch-sse/sseParser';
import type { MessageToolCall } from '@lobechat/types';

interface ToolCallAccumulator {
  function: {
    arguments: string;
    name: string;
  };
  id?: string;
  index: number;
  type?: string;
}

const mergeToolCallDelta = (
  toolCalls: Map<number, ToolCallAccumulator>,
  incoming: Array<Record<string, any>>,
) => {
  for (const item of incoming) {
    const index = typeof item.index === 'number' ? item.index : toolCalls.size;
    const current = toolCalls.get(index) || {
      function: { arguments: '', name: '' },
      index,
    };

    if (typeof item.id === 'string' && !current.id) current.id = item.id;
    if (typeof item.type === 'string' && !current.type) current.type = item.type;

    if (item.function && typeof item.function === 'object') {
      if (typeof item.function.name === 'string' && !current.function.name) {
        current.function.name = item.function.name;
      }

      if (typeof item.function.arguments === 'string') {
        current.function.arguments += item.function.arguments;
      }
    }

    toolCalls.set(index, current);
  }
};

const normalizeToolCalls = (toolCalls: Map<number, ToolCallAccumulator>): MessageToolCall[] =>
  [...toolCalls.values()]
    .sort((a, b) => a.index - b.index)
    .map((item) => ({
      function: {
        arguments: item.function.arguments,
        name: item.function.name,
      },
      id: item.id || `tool_call_${item.index}`,
      type: (item.type || 'function') as 'function',
    }));

export const parseChatCompletionTextResponse = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const chunks = parseSSEChunks(trimmed);
  if (chunks.length === 0) return undefined;

  let content = '';
  let finishReason: string | null | undefined;
  let reasoningContent = '';
  const toolCalls = new Map<number, ToolCallAccumulator>();

  for (const chunk of chunks) {
    if (chunk.data === '[DONE]' || chunk.data === 'STOP') continue;

    if (Array.isArray(chunk.data) && chunk.event === 'tool_calls') {
      mergeToolCallDelta(toolCalls, chunk.data as Array<Record<string, any>>);
      continue;
    }

    if (typeof chunk.data === 'string') {
      if (chunk.event === 'reasoning') {
        reasoningContent += chunk.data;
        continue;
      }

      if (chunk.event === 'stop') {
        finishReason = chunk.data;
        continue;
      }

      if (chunk.event === 'text') content += chunk.data;
      continue;
    }

    if (!chunk.data || typeof chunk.data !== 'object') continue;

    const choice = (chunk.data as Record<string, any>).choices?.[0];
    if (!choice) continue;

    finishReason = choice.finish_reason ?? finishReason;

    const message = choice.message;
    if (message && typeof message === 'object') {
      if (typeof message.content === 'string') content = message.content;
      if (typeof message.reasoning_content === 'string') {
        reasoningContent = message.reasoning_content;
      }
      if (Array.isArray(message.tool_calls)) {
        mergeToolCallDelta(toolCalls, message.tool_calls);
      }
    }

    const delta = choice.delta;
    if (!delta || typeof delta !== 'object') continue;

    if (typeof delta.content === 'string') content += delta.content;
    if (typeof delta.reasoning_content === 'string') {
      reasoningContent += delta.reasoning_content;
    }
    if (Array.isArray(delta.tool_calls)) {
      mergeToolCallDelta(toolCalls, delta.tool_calls);
    }
  }

  const normalizedToolCalls = normalizeToolCalls(toolCalls);
  if (!content && !reasoningContent && normalizedToolCalls.length === 0 && !finishReason) {
    return undefined;
  }

  return {
    choices: [
      {
        finish_reason: finishReason,
        message: {
          content,
          ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
          role: 'assistant',
          ...(normalizedToolCalls.length > 0 ? { tool_calls: normalizedToolCalls } : {}),
        },
      },
    ],
  };
};

export const readChatCompletionResult = async (response: Response) => {
  try {
    return await response.clone().json();
  } catch {
    // Fall back to text/SSE parsing below.
  }

  const text = await response.text();
  const parsed = parseChatCompletionTextResponse(text);
  if (parsed) return parsed;

  try {
    return JSON.parse(text);
  } catch {
    throw new SyntaxError(
      `Unable to parse chat completion response: ${text.slice(0, 120) || '<empty>'}`,
    );
  }
};
