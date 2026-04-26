import {
  type BuiltinToolManifest,
  DEFAULT_SEMANTIC_SEARCH_CHUNK_TOP_K,
  DEFAULT_SEMANTIC_SEARCH_FILE_TOP_K,
} from '@lobechat/types';

import { systemPrompt } from './systemRole';
import { SourceSetApiName, SourceSetIdentifier } from './types';

export const SourceSetManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'Search across source sets using semantic vector search to find relevant files and chunks. Returns a summary of matching files with relevance scores and brief excerpts. Use this first to discover which files contain relevant information. IMPORTANT: Since this uses vector-based search, always resolve pronouns and references to concrete entities (e.g., use "authentication system" instead of "it").',
      name: SourceSetApiName.searchSourceSet,
      parameters: {
        properties: {
          query: {
            description:
              'The search query to find relevant information. Be specific and use concrete entities. IMPORTANT: Resolve all pronouns and references (like "it", "that", "this") to actual entity names before searching, as this uses semantic vector search which works best with concrete terms.',
            type: 'string',
          },
          chunkTopK: {
            default: DEFAULT_SEMANTIC_SEARCH_CHUNK_TOP_K,
            description:
              'Number of top relevant chunks to retrieve before grouping results by file (default: 15).',
            maximum: 100,
            minimum: 5,
            type: 'number',
          },
          fileTopK: {
            default: DEFAULT_SEMANTIC_SEARCH_FILE_TOP_K,
            description: 'Number of files to summarize from the retrieved chunks (default: 15).',
            maximum: 100,
            minimum: 5,
            type: 'number',
          },
        },
        required: ['query'],
        type: 'object',
      },
    },
    {
      description:
        'Read the content of specific files from source sets. Use this after searchSourceSet to inspect the most relevant files. You can read multiple files at once.',
      name: SourceSetApiName.readSourceFiles,
      parameters: {
        properties: {
          fileIds: {
            description: 'Array of file IDs to read. Get these IDs from searchSourceSet results.',
            items: {
              type: 'string',
            },
            type: 'array',
          },
        },
        required: ['fileIds'],
        type: 'object',
      },
    },
  ],
  identifier: SourceSetIdentifier,
  meta: {
    avatar: '📚',
    description: 'Search uploaded documents and reusable references via semantic vector search',
    title: 'Source Set',
  },
  systemRole: systemPrompt,
  type: 'builtin',
};
