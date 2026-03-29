import type { ChatSemanticSearchChunk, FileSearchResult } from '@lobechat/types';

export const SourceSetIdentifier = 'lobe-source-set';

export const SourceSetApiName = {
  readSourceFiles: 'readSourceFiles',
  searchSourceSet: 'searchSourceSet',
};

export interface SearchSourceSetArgs {
  chunkTopK?: number;
  fileTopK?: number;
  query: string;
}
export interface SearchSourceSetState {
  chunks: ChatSemanticSearchChunk[];
  fileResults: FileSearchResult[];
  totalResults: number;
}

export interface ReadSourceFilesArgs {
  fileIds: string[];
}

export interface FileContentDetail {
  error?: string;
  fileId: string;
  filename: string;
  preview?: string;
  totalCharCount?: number;
  totalLineCount?: number;
}

export interface ReadSourceFilesState {
  files: FileContentDetail[];
}
