/**
 * Pure utilities for tool call chunk merging and transformation.
 * Extracted for testability. Used by api.ts SSE parser.
 */

import type { ChatToolPayload } from '../types';

export interface ToolInterventionPayload {
  rejectedReason?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'aborted' | 'none';
}

interface MobileToolFunction {
  arguments?: string;
  name?: string;
}

export interface MobileToolCallChunk {
  function?: MobileToolFunction;
  id?: string;
  index?: number;
  thoughtSignature?: string;
  type?: string;
}

/** Detect if payload is ChatToolPayload[] (server format) vs MobileToolCallChunk[] (LLM stream format) */
export const isChatToolPayloadArray = (payload: unknown[]): payload is ChatToolPayload[] =>
  payload.length > 0 &&
  payload.every(
    (item): item is ChatToolPayload =>
      typeof item === 'object' &&
      item !== null &&
      'apiName' in item &&
      'identifier' in item &&
      'arguments' in item &&
      !('function' in item),
  );

export const mergeToolCallChunks = (
  origin: MobileToolCallChunk[],
  value: MobileToolCallChunk[],
): MobileToolCallChunk[] => {
  const next = [...origin];

  if (next.length === 0) {
    return value.map((item) => ({
      ...item,
      function: {
        arguments: item.function?.arguments || '',
        name: item.function?.name || '',
      },
      id: item.id || `${item.index || 0}`,
      type: item.type || 'function',
    }));
  }

  for (const incoming of value) {
    const index = incoming.index ?? 0;
    const incomingId = incoming.id;
    const existingByIdIndex = incomingId ? next.findIndex((item) => item.id === incomingId) : -1;

    if (existingByIdIndex !== -1) {
      const existing = next[existingByIdIndex];
      next[existingByIdIndex] = {
        ...existing,
        ...incoming,
        function: {
          arguments:
            (existing.function?.arguments || '') + (incoming.function?.arguments || ''),
          name: incoming.function?.name || existing.function?.name || '',
        },
      };
      continue;
    }

    if (!next[index]) {
      next.splice(index, 0, {
        ...incoming,
        function: {
          arguments: incoming.function?.arguments || '',
          name: incoming.function?.name || '',
        },
        id: incomingId || `${index}`,
        type: incoming.type || 'function',
      });
      continue;
    }

    const existingAtIndex = next[index];
    if (incomingId && existingAtIndex?.id !== incomingId) {
      next.push({
        ...incoming,
        function: {
          arguments: incoming.function?.arguments || '',
          name: incoming.function?.name || '',
        },
        id: incomingId,
        type: incoming.type || 'function',
      });
      continue;
    }

    next[index] = {
      ...existingAtIndex,
      ...incoming,
      function: {
        arguments:
          (existingAtIndex.function?.arguments || '') + (incoming.function?.arguments || ''),
        name: incoming.function?.name || existingAtIndex.function?.name || '',
      },
    };
  }

  return next;
};

interface MobileToolCallChunkWithIntervention extends MobileToolCallChunk {
  intervention?: ToolInterventionPayload;
}

export const transformToolCalls = (toolCalls: MobileToolCallChunk[]): ChatToolPayload[] =>
  toolCalls.map((toolCall, index) => {
    const fullName = toolCall.function?.name || `tool_${index + 1}`;
    const slashSegments = fullName.split('/');
    const slashApiName = slashSegments.pop() || fullName;
    const slashIdentifier = slashSegments.join('/');
    const [underscoreIdentifier, underscoreApiName] = fullName.split('____');
    const identifier = underscoreApiName ? underscoreIdentifier : slashIdentifier || fullName;
    const apiName = underscoreApiName || slashApiName;
    const withIntervention = toolCall as MobileToolCallChunkWithIntervention;

    return {
      apiName,
      arguments: toolCall.function?.arguments || '{}',
      id: toolCall.id || `${index}`,
      identifier,
      intervention: withIntervention.intervention,
      source: identifier.startsWith('lobe-') ? 'builtin' : undefined,
      thoughtSignature: toolCall.thoughtSignature,
      type: 'default',
    };
  });
