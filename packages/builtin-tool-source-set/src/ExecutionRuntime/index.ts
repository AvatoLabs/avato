import { formatSearchResults, promptFileContents, promptNoSearchResults } from '@lobechat/prompts';
import {
  type BuiltinServerRuntimeOutput,
  resolveSemanticSearchLimits,
  type SemanticSearchSchemaType,
} from '@lobechat/types';

import type {
  ReadSourceFilesArgs,
  ReadSourceFilesState,
  SearchSourceSetArgs,
  SearchSourceSetState,
} from '../types';

interface FileContentResult {
  content: string;
  error?: string;
  fileId: string;
  filename: string;
  preview?: string;
  totalCharCount?: number;
  totalLineCount?: number;
}

interface RagService {
  getFileContents: (fileIds: string[], signal?: AbortSignal) => Promise<FileContentResult[]>;
  semanticSearchForChat: (
    params: Pick<SemanticSearchSchemaType, 'chunkTopK' | 'fileTopK' | 'query' | 'sourceSetIds'>,
    signal?: AbortSignal,
  ) => Promise<{ chunks: any[]; fileResults: any[] }>;
}

export class SourceSetExecutionRuntime {
  private ragService: RagService;

  constructor(ragService: RagService) {
    this.ragService = ragService;
  }

  /**
   * Search configured source sets and return file summaries with relevant chunks
   */
  async searchSourceSet(
    args: SearchSourceSetArgs,
    options?: {
      sourceSetIds?: string[];
      messageId?: string;
      signal?: AbortSignal;
    },
  ): Promise<BuiltinServerRuntimeOutput> {
    try {
      const { chunkTopK, fileTopK } = resolveSemanticSearchLimits(args);
      const { query } = args;

      // Only search in configured source sets, not agent files
      // Agent files will be injected as full content in context-engine
      const { chunks, fileResults } = await this.ragService.semanticSearchForChat(
        { chunkTopK, fileTopK, query, sourceSetIds: options?.sourceSetIds },
        options?.signal,
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
        error: e,
        success: false,
      };
    }
  }

  /**
   * Read full content of specific files from source sets
   */
  async readSourceFiles(
    args: ReadSourceFilesArgs,
    options?: { signal?: AbortSignal },
  ): Promise<BuiltinServerRuntimeOutput> {
    try {
      const { fileIds } = args;

      if (!fileIds || fileIds.length === 0) {
        return {
          content: 'Error: No file IDs provided',
          success: false,
        };
      }

      const fileContents = await this.ragService.getFileContents(fileIds, options?.signal);

      const formattedContent = promptFileContents(fileContents);

      const state: ReadSourceFilesState = {
        files: fileContents.map((file) => ({
          error: file.error,
          fileId: file.fileId,
          filename: file.filename,
          preview: file.preview,
          totalCharCount: file.totalCharCount,
          totalLineCount: file.totalLineCount,
        })),
      };

      return { content: formattedContent, state, success: true };
    } catch (e) {
      return {
        content: `Error reading source files: ${(e as Error).message}`,
        error: e,
        success: false,
      };
    }
  }
}
