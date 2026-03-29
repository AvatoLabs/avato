import { SourceSetIdentifier } from '@lobechat/builtin-tool-source-set';
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

const { sourceSetRuntime } = await import('../sourceSet');

describe('sourceSetRuntime', () => {
  it('should have the correct identifier', () => {
    expect(sourceSetRuntime.identifier).toBe(SourceSetIdentifier);
  });

  describe('factory', () => {
    it('should throw when serverDB is missing', () => {
      const context: ToolExecutionContext = {
        toolManifestMap: {},
        userId: 'user-1',
      };

      expect(() => sourceSetRuntime.factory(context)).toThrow(
        'serverDB is required for Source Set server runtime execution',
      );
    });

    it('should throw when userId is missing', () => {
      const context: ToolExecutionContext = {
        serverDB: {} as any,
        toolManifestMap: {},
      };

      expect(() => sourceSetRuntime.factory(context)).toThrow(
        'userId is required for Source Set server runtime execution',
      );
    });

    it('should create a runtime backed by ServerRagService', () => {
      const context: ToolExecutionContext = {
        serverDB: { query: {} } as any,
        toolManifestMap: {},
        userId: 'user-1',
      };

      const runtime = sourceSetRuntime.factory(context);

      expect(mockServerRagService).toHaveBeenCalledWith(context.serverDB, 'user-1');
      expect(runtime.searchSourceSet).toBeDefined();
      expect(runtime.readSourceFiles).toBeDefined();
    });
  });
});
