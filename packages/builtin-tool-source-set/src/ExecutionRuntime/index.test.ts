import {
  DEFAULT_SEMANTIC_SEARCH_CHUNK_TOP_K,
  DEFAULT_SEMANTIC_SEARCH_FILE_TOP_K,
} from '@lobechat/types';
import { describe, expect, it, vi } from 'vitest';

import { SourceSetExecutionRuntime } from './index';

describe('SourceSetExecutionRuntime', () => {
  describe('searchSourceSet', () => {
    it('should use unified default limits when no explicit limit is provided', async () => {
      const ragService = {
        getFileContents: vi.fn(),
        semanticSearchForChat: vi.fn().mockResolvedValue({
          chunks: [],
          fileResults: [],
        }),
      };
      const runtime = new SourceSetExecutionRuntime(ragService);

      await runtime.searchSourceSet({ query: 'architecture overview' }, { sourceSetIds: ['kb-1'] });

      expect(ragService.semanticSearchForChat).toHaveBeenCalledWith(
        {
          chunkTopK: DEFAULT_SEMANTIC_SEARCH_CHUNK_TOP_K,
          fileTopK: DEFAULT_SEMANTIC_SEARCH_FILE_TOP_K,
          query: 'architecture overview',
          sourceSetIds: ['kb-1'],
        },
        undefined,
      );
    });
  });
});
