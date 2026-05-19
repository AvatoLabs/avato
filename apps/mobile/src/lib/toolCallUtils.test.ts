import { describe, expect, it } from 'vitest';

import {
  isChatToolPayloadArray,
  mergeToolCallChunks,
  transformToolCalls,
} from './toolCallUtils';

describe('toolCallUtils', () => {
  describe('isChatToolPayloadArray', () => {
    it('returns true for ChatToolPayload[] with apiName, identifier, arguments', () => {
      const payload = [
        {
          apiName: 'search',
          arguments: '{}',
          id: '1',
          identifier: 'lobe-web-browsing',
          type: 'function',
        },
      ];
      expect(isChatToolPayloadArray(payload)).toBe(true);
    });

    it('returns false for empty array', () => {
      expect(isChatToolPayloadArray([])).toBe(false);
    });

    it('returns false for MobileToolCallChunk[] (has function property)', () => {
      const payload = [
        {
          function: { name: 'lobe-web-browsing/search', arguments: '{}' },
          id: '1',
          type: 'function',
        },
      ];
      expect(isChatToolPayloadArray(payload)).toBe(false);
    });

    it('returns false when missing apiName', () => {
      const payload = [
        { arguments: '{}', id: '1', identifier: 'x', type: 'function' } as any,
      ];
      expect(isChatToolPayloadArray(payload)).toBe(false);
    });

    it('returns false when missing identifier', () => {
      const payload = [
        { apiName: 'x', arguments: '{}', id: '1', type: 'function' } as any,
      ];
      expect(isChatToolPayloadArray(payload)).toBe(false);
    });
  });

  describe('mergeToolCallChunks', () => {
    it('returns value when origin is empty', () => {
      const value = [
        {
          function: { name: 'search', arguments: '{"q":"x"}' },
          id: '1',
          index: 0,
        },
      ];
      const result = mergeToolCallChunks([], value);
      expect(result).toHaveLength(1);
      expect(result[0]!.function?.name).toBe('search');
      expect(result[0]!.function?.arguments).toBe('{"q":"x"}');
    });

    it('merges arguments when same id', () => {
      const origin = [
        {
          function: { name: 'search', arguments: '{"q":"' },
          id: '1',
          index: 0,
        },
      ];
      const value = [
        {
          function: { arguments: 'x"}' },
          id: '1',
          index: 0,
        },
      ];
      const result = mergeToolCallChunks(origin, value);
      expect(result).toHaveLength(1);
      expect(result[0]!.function?.arguments).toBe('{"q":"' + 'x"}');
    });

    it('appends new chunk when different id', () => {
      const origin = [
        { function: { name: 'a', arguments: '{}' }, id: '1', index: 0 },
      ];
      const value = [
        { function: { name: 'b', arguments: '{}' }, id: '2', index: 1 },
      ];
      const result = mergeToolCallChunks(origin, value);
      expect(result).toHaveLength(2);
      expect(result[0]!.function?.name).toBe('a');
      expect(result[1]!.function?.name).toBe('b');
    });
  });

  describe('transformToolCalls', () => {
    it('parses identifier/apiName from slash format', () => {
      const chunks = [
        {
          function: {
            name: 'lobe-web-browsing/search',
            arguments: '{"query":"test"}',
          },
          id: '1',
        },
      ];
      const result = transformToolCalls(chunks);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        identifier: 'lobe-web-browsing',
        apiName: 'search',
        arguments: '{"query":"test"}',
        id: '1',
        source: 'builtin',
      });
    });

    it('parses identifier____apiName from underscore format', () => {
      const chunks = [
        {
          function: {
            name: 'my-plugin____doSomething',
            arguments: '{}',
          },
          id: '2',
        },
      ];
      const result = transformToolCalls(chunks);
      expect(result[0]).toMatchObject({
        identifier: 'my-plugin',
        apiName: 'doSomething',
      });
      expect(result[0]!.source).toBeUndefined(); // my-plugin does not start with lobe-
    });

    it('uses tool_N fallback when function.name is missing', () => {
      const chunks = [{ function: { arguments: '{}' }, id: 'x' }];
      const result = transformToolCalls(chunks);
      expect(result[0]!.apiName).toBe('tool_1');
      expect(result[0]!.identifier).toBe('tool_1');
    });

    it('uses empty object for missing arguments', () => {
      const chunks = [
        { function: { name: 'lobe-gtd/createPlan' }, id: '1' },
      ];
      const result = transformToolCalls(chunks);
      expect(result[0]!.arguments).toBe('{}');
    });
  });
});
