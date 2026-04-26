const EMBEDDING_BATCH_SIZE_LIMITS: Record<string, Record<string, number>> = {
  qwen: {
    // DashScope rejects text-embedding-v4 requests when input.contents exceeds 10 items.
    'text-embedding-v4': 10,
  },
};

interface GetEffectiveEmbeddingBatchSizeParams {
  configuredBatchSize: number;
  model: string;
  provider: string;
}

export const getEffectiveEmbeddingBatchSize = ({
  configuredBatchSize,
  model,
  provider,
}: GetEffectiveEmbeddingBatchSizeParams) => {
  const limit = EMBEDDING_BATCH_SIZE_LIMITS[provider]?.[model];

  return limit ? Math.min(configuredBatchSize, limit) : configuredBatchSize;
};
