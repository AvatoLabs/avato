import { KnowledgeBaseIdentifier } from '@lobechat/builtin-tool-knowledge-base';
import { describe, expect, it, vi } from 'vitest';

import { type ToolExecutionContext } from '../../types';

const mockServerRagService = vi.fn();

vi.mock('@/server/services/rag', () => ({
  ServerRagService: vi.fn().mockImplementation((...args: any[]) => {
    mockServerRagService(...args);
    return {
      getFileContents: vi.fn(),
      semanticSearchForChat: vi.fn(),
    };
  }),
}));

const { knowledgeBaseRuntime } = await import('../knowledgeBase');

describe('knowledgeBaseRuntime', () => {
  it('should have the correct identifier', () => {
    expect(knowledgeBaseRuntime.identifier).toBe(KnowledgeBaseIdentifier);
  });

  describe('factory', () => {
    it('should throw when serverDB is missing', () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
        userId: 'user-1',
      };

      expect(() => knowledgeBaseRuntime.factory(context)).toThrow(
        'serverDB is required for Knowledge Base server runtime execution',
      );
    });

    it('should throw when userId is missing', () => {
      const context: ToolExecutionContext = {
        serverDB: {} as any,
        toolManifestMap: {},
      };

      expect(() => knowledgeBaseRuntime.factory(context)).toThrow(
        'userId is required for Knowledge Base server runtime execution',
      );
    });

    it('should create a runtime backed by ServerRagService', () => {
      const context: ToolExecutionContext = {
        serverDB: { query: {} } as any,
        toolManifestMap: {},
        userId: 'user-1',
      };

      const runtime = knowledgeBaseRuntime.factory(context);

      expect(mockServerRagService).toHaveBeenCalledWith(context.serverDB, 'user-1');
      expect(runtime.searchKnowledgeBase).toBeDefined();
      expect(runtime.readKnowledge).toBeDefined();
    });
  });
});
