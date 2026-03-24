import { z } from 'zod';

import type { ChatSemanticSearchChunk } from './chunk';

export const DEFAULT_SEMANTIC_SEARCH_CHUNK_TOP_K = 15;
export const DEFAULT_SEMANTIC_SEARCH_FILE_TOP_K = 15;

export const SemanticSearchSchema = z.object({
  chunkTopK: z.number().optional(),
  fileIds: z.array(z.string()).optional(),
  fileTopK: z.number().optional(),
  knowledgeIds: z.array(z.string()).optional(),
  query: z.string(),
});

export type SemanticSearchSchemaType = z.infer<typeof SemanticSearchSchema>;

export const resolveSemanticSearchLimits = (
  params: Pick<SemanticSearchSchemaType, 'chunkTopK' | 'fileTopK'>,
) => ({
  chunkTopK: params.chunkTopK ?? DEFAULT_SEMANTIC_SEARCH_CHUNK_TOP_K,
  fileTopK: params.fileTopK ?? DEFAULT_SEMANTIC_SEARCH_FILE_TOP_K,
});

export type MessageSemanticSearchChunk = Pick<ChatSemanticSearchChunk, 'id' | 'similarity'>;

export interface FileSearchResult {
  fileId: string;
  fileName: string;
  relevanceScore: number;
  topChunks: Array<{
    id: string;
    similarity: number;
    text: string;
  }>;
}
