import { formatSearchResults, promptFileContents, promptNoSearchResults } from '@lobechat/prompts';
import {
  type BuiltinToolContext,
  type BuiltinToolResult,
  resolveSemanticSearchLimits,
} from '@lobechat/types';
import { BaseExecutor } from '@lobechat/types';

import { ragService } from '@/services/rag';
import { agentSelectors } from '@/store/agent/selectors';
import { getAgentStoreState } from '@/store/agent/store';

import type {
  FileContentDetail,
  ReadSourceFilesArgs,
  ReadSourceFilesState,
  SearchSourceSetArgs,
  SearchSourceSetState,
} from '../types';
import { SourceSetIdentifier } from '../types';

/**
 * Source-set tool executor
 *
 * Handles source-set search and file retrieval operations.
 */
class SourceSetExecutor extends BaseExecutor<{
  readSourceFiles: 'readSourceFiles';
  searchSourceSet: 'searchSourceSet';
}> {
  readonly identifier = SourceSetIdentifier;
  protected readonly apiEnum = {
    readSourceFiles: 'readSourceFiles' as const,
    searchSourceSet: 'searchSourceSet' as const,
  };

  /**
   * Search configured source sets and return file summaries with relevant chunks
   */
  searchSourceSet = async (
    params: SearchSourceSetArgs,
    ctx: BuiltinToolContext,
  ): Promise<BuiltinToolResult> => {
    try {
      const { chunkTopK, fileTopK } = resolveSemanticSearchLimits(params);
      const { query } = params;

      // Get enabled source-set IDs from the agent store
      const agentState = getAgentStoreState();
      const enabledSources = agentSelectors.currentSourceIds(agentState);

      // Only search in configured source sets, not agent files
      // Agent files will be injected as full content in context-engine
      const sourceSetIds = enabledSources.sourceSetIds;

      const { chunks, fileResults } = await ragService.semanticSearchForChat(
        { chunkTopK, fileTopK, query, sourceSetIds },
        ctx.signal,
      );

      if (chunks.length === 0) {
        const state: SearchSourceSetState = { chunks: [], fileResults: [], totalResults: 0 };

        return { content: promptNoSearchResults(query), state, success: true };
      }

      // Format search results for AI
      const formattedContent = formatSearchResults(fileResults, query);

      const state: SearchSourceSetState = { chunks, fileResults, totalResults: chunks.length };

      return { content: formattedContent, state, success: true };
    } catch (e) {
      return {
        content: `Error searching source sets: ${(e as Error).message}`,
        error: { body: e, message: (e as Error).message, type: 'PluginServerError' },
        success: false,
      };
    }
  };

  /**
   * Read full content of specific files from source sets
   */
  readSourceFiles = async (params: ReadSourceFilesArgs): Promise<BuiltinToolResult> => {
    try {
      const { fileIds } = params;

      if (!fileIds || fileIds.length === 0) {
        return {
          content: 'Error: No file IDs provided',
          success: false,
        };
      }

      const fileContents = await ragService.getFileContents(fileIds);

      const formattedContent = promptFileContents(fileContents);

      const state: ReadSourceFilesState = {
        files: fileContents.map(
          (file): FileContentDetail => ({
            error: file.error,
            fileId: file.fileId,
            filename: file.filename,
            preview: file.preview,
            totalCharCount: file.totalCharCount,
            totalLineCount: file.totalLineCount,
          }),
        ),
      };

      return { content: formattedContent, state, success: true };
    } catch (e) {
      return {
        content: `Error reading source files: ${(e as Error).message}`,
        error: { body: e, message: (e as Error).message, type: 'PluginServerError' },
        success: false,
      };
    }
  };
}

// Export the executor instance for registration
export const sourceSetExecutor = new SourceSetExecutor();
