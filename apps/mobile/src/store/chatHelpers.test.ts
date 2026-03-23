import { describe, expect, it, vi } from 'vitest';

import {
  mergeResolvedToolPayloads,
  mergeToolPayloads,
  mergeToolPayloadsCore,
  toolExecutionsToPayloads,
} from './chatHelpers';

vi.mock('../lib/api', () => ({
  agentApi: {},
  configApi: {},
  userApi: {},
}));
vi.mock('./model', () => ({ useModelStore: { getState: () => ({ providers: [] }) } }));
vi.mock('./session', () => ({ useSessionStore: { getState: () => ({ sessions: [] }) } }));
vi.mock('./user', () => ({ getUserMemorySettings: vi.fn() }));
vi.mock('../lib/session', () => ({ isGroupSessionLike: () => false }));

const baseTool = (
  overrides: Partial<{
    id: string;
    identifier: string;
    apiName: string;
    arguments: string;
    result_content: string;
    result_msg_id: string;
    intervention: { status: string };
    pluginState: Record<string, unknown>;
  }> = {},
) => ({
  apiName: 'search',
  arguments: '{}',
  id: 'tc-1',
  identifier: 'lobe-web-browsing',
  intervention: { status: 'approved' as const },
  result_content: undefined,
  result_msg_id: undefined,
  type: 'function',
  ...overrides,
});

describe('chatHelpers', () => {
  describe('toolExecutionsToPayloads', () => {
    it('maps executions to ChatToolPayload[]', () => {
      const executions = [
        {
          apiName: 'search',
          arguments: '{"query":"test"}',
          id: 'exec-1',
          identifier: 'lobe-web-browsing',
          result: 'search result',
        },
      ];
      const payloads = toolExecutionsToPayloads(executions);
      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        apiName: 'search',
        arguments: '{"query":"test"}',
        id: 'exec-1',
        identifier: 'lobe-web-browsing',
        result_content: 'search result',
        result_msg_id: 'exec-1',
        intervention: { status: 'approved' },
        type: 'function',
      });
      expect(payloads[0]!.source).toBe('builtin');
    });

    it('marks plugin identifier as plugin source', () => {
      const payloads = toolExecutionsToPayloads([
        { apiName: 'foo', arguments: '{}', id: '1', identifier: 'my-plugin', result: '' },
      ]);
      expect(payloads[0]!.source).toBe('plugin');
    });
  });

  describe('mergeToolPayloadsCore', () => {
    it('returns incoming when previous is empty', () => {
      const incoming = [baseTool({ id: 'a' })];
      expect(mergeToolPayloadsCore([], incoming)).toEqual(incoming);
    });

    it('returns previous when incoming is empty', () => {
      const previous = [baseTool({ id: 'a' })];
      expect(mergeToolPayloadsCore(previous, [])).toEqual(previous);
    });

    it('merges by id, preferring incoming result_content', () => {
      const previous = [
        baseTool({ id: 'tc-1', result_content: undefined, intervention: { status: 'pending' } }),
      ];
      const incoming = [
        baseTool({
          id: 'tc-1',
          result_content: 'done',
          result_msg_id: 'tc-1',
          intervention: { status: 'approved' },
        }),
      ];
      const merged = mergeToolPayloadsCore(previous, incoming, { autoApproveOnResult: true });
      expect(merged).toHaveLength(1);
      expect(merged[0]).toMatchObject({
        id: 'tc-1',
        result_content: 'done',
        result_msg_id: 'tc-1',
        intervention: { status: 'approved' },
      });
    });

    it('uses identifier:apiName as key when id is missing', () => {
      const prev = baseTool({ id: 'x', identifier: 'pkg', apiName: 'bar' });
      const inc = baseTool({
        id: 'x',
        identifier: 'pkg',
        apiName: 'bar',
        result_content: 'updated',
      });
      const merged = mergeToolPayloadsCore([prev], [inc]);
      expect(merged[0]!.result_content).toBe('updated');
    });

    it('appends new tools and preserves order', () => {
      const previous = [baseTool({ id: 'a' }), baseTool({ id: 'b' })];
      const incoming = [baseTool({ id: 'c' }), baseTool({ id: 'a', result_content: 'a-result' })];
      const merged = mergeToolPayloadsCore(previous, incoming);
      expect(merged.map((t) => t.id)).toEqual(['a', 'b', 'c']);
      expect(merged.find((t) => t.id === 'a')!.result_content).toBe('a-result');
    });

    it('preserves pluginState from incoming', () => {
      const previous = [baseTool({ id: 'a', pluginState: { old: true } })];
      const incoming = [baseTool({ id: 'a', pluginState: { new: true } })];
      const merged = mergeToolPayloadsCore(previous, incoming);
      expect(merged[0]!.pluginState).toEqual({ new: true });
    });

    it('with autoApproveOnResult: false, does not auto-approve on result', () => {
      const previous = [
        baseTool({ id: 'a', intervention: { status: 'pending' }, result_content: undefined }),
      ];
      const incoming = [
        baseTool({
          id: 'a',
          result_content: 'done',
          result_msg_id: 'a',
          intervention: undefined,
        }),
      ];
      const merged = mergeToolPayloadsCore(previous, incoming, { autoApproveOnResult: false });
      expect(merged[0]!.intervention).toEqual({ status: 'pending' });
    });
  });

  describe('mergeToolPayloads', () => {
    it('returns undefined when both are empty', () => {
      expect(mergeToolPayloads(undefined, undefined)).toBeUndefined();
      expect(mergeToolPayloads([], undefined)).toBeUndefined();
      expect(mergeToolPayloads(undefined, [])).toBeUndefined();
    });

    it('returns incoming when previous has no length', () => {
      const inc = [baseTool({ id: 'x' })];
      expect(mergeToolPayloads(undefined, inc)).toBe(inc);
      expect(mergeToolPayloads([], inc)).toBe(inc);
    });

    it('returns previous when incoming has no length', () => {
      const prev = [baseTool({ id: 'x' })];
      expect(mergeToolPayloads(prev, undefined)).toBe(prev);
      expect(mergeToolPayloads(prev, [])).toBe(prev);
    });

    it('delegates to mergeToolPayloadsCore with autoApproveOnResult: true', () => {
      const prev = [baseTool({ id: 'a', intervention: { status: 'pending' } })];
      const inc = [baseTool({ id: 'a', result_content: 'ok', result_msg_id: 'a' })];
      const merged = mergeToolPayloads(prev, inc);
      expect(merged![0]!.intervention!.status).toBe('approved');
    });
  });

  describe('mergeResolvedToolPayloads', () => {
    it('returns tools when executions is undefined', () => {
      const tools = [baseTool({ id: 'x' })];
      expect(mergeResolvedToolPayloads(tools, undefined)).toBe(tools);
    });

    it('merges toolExecutionsToPayloads result with tools', () => {
      const tools = [baseTool({ id: 'tc-1' })];
      const executions = [
        {
          apiName: 'search',
          arguments: '{}',
          id: 'tc-1',
          identifier: 'lobe-web-browsing',
          result: 'result text',
        },
      ];
      const merged = mergeResolvedToolPayloads(tools, executions);
      expect(merged).toHaveLength(1);
      expect(merged![0]!.result_content).toBe('result text');
    });
  });
});
