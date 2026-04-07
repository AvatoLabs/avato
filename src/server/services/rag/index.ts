import { DEFAULT_FILE_EMBEDDING_MODEL_ITEM } from '@lobechat/const';
import {
  type ChatSemanticSearchChunk,
  type FileSearchResult,
  isRawFileContentId,
  resolveSemanticSearchLimits,
  type SemanticSearchSchemaType,
} from '@lobechat/types';
import { inArray } from 'drizzle-orm';
import pMap from 'p-map';

import { ChunkModel } from '@/database/models/chunk';
import { DocumentModel } from '@/database/models/document';
import { sourceSetFiles } from '@/database/schemas';
import type { LobeChatDatabase } from '@/database/type';
import { getServerDefaultFilesConfig } from '@/server/globalConfig';
import { initModelRuntimeFromDB } from '@/server/modules/ModelRuntime';
import { AuthorizedResourceResolver, ContentAuthorizer } from '@/server/services/content';
import { DocumentService } from '@/server/services/document';

import { assertRagEmbeddingDimensions, RAG_EMBEDDING_DIMENSIONS } from './constants';

interface FileContentResult {
  content: string;
  error?: string;
  fileId: string;
  filename: string;
  metadata?: Record<string, unknown> | null;
  preview?: string;
  totalCharCount?: number;
  totalLineCount?: number;
}

const filterRawFileIds = (fileIds: string[]) => fileIds.filter(isRawFileContentId);

const groupAndRankFiles = (
  chunks: ChatSemanticSearchChunk[],
  fileTopK: number,
): FileSearchResult[] => {
  const fileMap = new Map<string, FileSearchResult>();

  for (const chunk of chunks) {
    const fileId = chunk.fileId || 'unknown';
    const fileName = chunk.fileName || `File ${fileId}`;

    if (!fileMap.has(fileId)) {
      fileMap.set(fileId, {
        fileId,
        fileName,
        relevanceScore: 0,
        topChunks: [],
      });
    }

    const fileResult = fileMap.get(fileId)!;
    fileResult.topChunks.push({
      id: chunk.id,
      similarity: chunk.similarity,
      text: chunk.text || '',
    });
  }

  for (const fileResult of fileMap.values()) {
    fileResult.topChunks.sort((a, b) => b.similarity - a.similarity);
    const top3 = fileResult.topChunks.slice(0, 3);
    fileResult.relevanceScore =
      top3.reduce((sum, chunk) => sum + chunk.similarity, 0) / top3.length;
    fileResult.topChunks = fileResult.topChunks.slice(0, 3);
  }

  return Array.from(fileMap.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, fileTopK);
};

const RAG_DIVERSITY_OVERSAMPLE_FACTOR = 3;

const selectDiverseChunks = (
  chunks: ChatSemanticSearchChunk[],
  chunkTopK: number,
): ChatSemanticSearchChunk[] => {
  if (chunks.length <= chunkTopK) return chunks;

  const fileMap = new Map<string, ChatSemanticSearchChunk[]>();

  for (const chunk of chunks) {
    const fileId = chunk.fileId || 'unknown';
    if (!fileMap.has(fileId)) {
      fileMap.set(fileId, []);
    }

    fileMap.get(fileId)!.push(chunk);
  }

  const rankedGroups = Array.from(fileMap.values()).sort(
    (a, b) => (b[0]?.similarity ?? 0) - (a[0]?.similarity ?? 0),
  );

  const selected: ChatSemanticSearchChunk[] = [];
  let cursor = 0;

  while (selected.length < chunkTopK) {
    let added = false;

    for (const group of rankedGroups) {
      const chunk = group[cursor];
      if (!chunk) continue;

      selected.push(chunk);
      added = true;

      if (selected.length >= chunkTopK) break;
    }

    if (!added) break;
    cursor += 1;
  }

  return selected;
};

export class ServerRagService {
  private readonly chunkModel: ChunkModel;
  private readonly documentModel: DocumentModel;
  private readonly documentService: DocumentService;
  private readonly resolver: AuthorizedResourceResolver;
  private readonly contentAuthorizer: ContentAuthorizer;

  constructor(
    private readonly serverDB: LobeChatDatabase,
    private readonly userId: string,
  ) {
    this.chunkModel = new ChunkModel(serverDB, userId);
    this.documentModel = new DocumentModel(serverDB, userId);
    this.documentService = new DocumentService(serverDB, userId);
    this.resolver = new AuthorizedResourceResolver(serverDB, userId);
    this.contentAuthorizer = new ContentAuthorizer(serverDB, userId);
  }

  getFileContents = async (
    fileIds: string[],
    _signal?: AbortSignal,
  ): Promise<FileContentResult[]> => {
    const rawFileIds = filterRawFileIds(fileIds);
    if (rawFileIds.length === 0) return [];

    const readableFileIds = await this.contentAuthorizer.filterReadableFileIds(rawFileIds);

    return pMap(
      readableFileIds,
      async (fileId) => {
        const file = await this.resolver.requireFile(fileId, 'preview_content');

        let document:
          | {
              content: string | null;
              metadata: Record<string, unknown> | null;
            }
          | undefined = await this.documentModel.findByFileId(fileId);

        if (!document) {
          try {
            document = await this.documentService.parseFile(fileId);
          } catch (error) {
            return {
              content: '',
              error: `Failed to parse file: ${(error as Error).message}`,
              fileId,
              filename: file.name,
            };
          }
        }

        const content = document.content || '';
        const lines = content.split('\n');

        return {
          content,
          fileId,
          filename: file.name,
          metadata: document.metadata,
          preview: lines.slice(0, 5).join('\n'),
          totalCharCount: content.length,
          totalLineCount: lines.length,
        };
      },
      { concurrency: 3 },
    );
  };

  semanticSearch = async ({
    fileIds,
    query,
  }: Pick<SemanticSearchSchemaType, 'fileIds' | 'query'>) => {
    const rawFileIds = fileIds ? filterRawFileIds(fileIds) : undefined;
    const readableFileIds = rawFileIds
      ? await this.contentAuthorizer.filterReadableFileIds(rawFileIds)
      : undefined;

    if (fileIds && readableFileIds.length === 0) return [];

    const { embedding, model } = await this.createQueryEmbedding(query);

    return this.chunkModel.semanticSearch({
      embedding,
      embeddingModel: model,
      fileIds: readableFileIds,
    });
  };

  semanticSearchForChat = async (
    params: Pick<
      SemanticSearchSchemaType,
      'chunkTopK' | 'fileIds' | 'fileTopK' | 'query' | 'sourceSetIds'
    >,
    _signal?: AbortSignal,
  ) => {
    const { chunkTopK, fileTopK } = resolveSemanticSearchLimits(params);
    const finalFileIds = await this.resolveSearchFileIds(params);

    if (finalFileIds.length === 0) {
      return { chunks: [], fileResults: [] };
    }

    const { embedding, model } = await this.createQueryEmbedding(params.query);

    const rawChunks = await this.chunkModel.semanticSearchForChat({
      chunkTopK: chunkTopK * RAG_DIVERSITY_OVERSAMPLE_FACTOR,
      embedding,
      embeddingModel: model,
      fileIds: finalFileIds,
    });
    const chunks = selectDiverseChunks(rawChunks, chunkTopK);

    const fileResults = groupAndRankFiles(chunks, fileTopK);

    return { chunks, fileResults };
  };

  private createQueryEmbedding = async (query: string) => {
    const { model, provider } =
      getServerDefaultFilesConfig().embeddingModel || DEFAULT_FILE_EMBEDDING_MODEL_ITEM;
    const modelRuntime = await initModelRuntimeFromDB(this.serverDB, this.userId, provider);
    const input = query.length > 8000 ? query.slice(0, 8000) : query;
    const embeddings = await modelRuntime.embeddings({
      dimensions: RAG_EMBEDDING_DIMENSIONS,
      input,
      model,
    });
    assertRagEmbeddingDimensions(embeddings, `query embedding:${provider}/${model}`);

    return { embedding: embeddings![0], model };
  };

  private resolveSearchFileIds = async ({
    fileIds,
    sourceSetIds,
  }: Pick<SemanticSearchSchemaType, 'fileIds' | 'sourceSetIds'>) => {
    const rawFileIds = fileIds ? filterRawFileIds(fileIds) : undefined;
    const readableFileIds = rawFileIds
      ? await this.contentAuthorizer.filterReadableFileIds(rawFileIds)
      : [];

    if (!sourceSetIds || sourceSetIds.length === 0) {
      return [...new Set(readableFileIds)];
    }

    const readableSourceSetIds =
      await this.contentAuthorizer.filterReadableSourceSetIds(sourceSetIds);

    if (readableSourceSetIds.length === 0) {
      return [...new Set(readableFileIds)];
    }

    const sourceSetFileLinks = await this.serverDB.query.sourceSetFiles.findMany({
      where: inArray(sourceSetFiles.sourceSetId, readableSourceSetIds),
    });

    return [...new Set([...sourceSetFileLinks.map((file) => file.fileId), ...readableFileIds])];
  };
}
