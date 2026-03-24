export const RAG_EMBEDDING_DIMENSIONS = 1024;

export const assertRagEmbeddingDimensions = (
  embeddings: ArrayLike<number[]> | undefined | null,
  source: string,
) => {
  if (!embeddings) {
    throw new Error(`[RAG] No embeddings returned from ${source}`);
  }

  for (const embedding of embeddings) {
    if (embedding.length !== RAG_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `[RAG] Invalid embedding dimensions from ${source}: expected ${RAG_EMBEDDING_DIMENSIONS}, got ${embedding.length}`,
      );
    }
  }
};
