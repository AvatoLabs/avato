import { describe, expect, it } from 'vitest';

import { getEffectiveEmbeddingBatchSize } from './embeddingLimits';

describe('getEffectiveEmbeddingBatchSize', () => {
  it('caps qwen text-embedding-v4 requests at 10 items', () => {
    expect(
      getEffectiveEmbeddingBatchSize({
        configuredBatchSize: 50,
        model: 'text-embedding-v4',
        provider: 'qwen',
      }),
    ).toBe(10);
  });

  it('keeps smaller configured batch sizes for qwen text-embedding-v4', () => {
    expect(
      getEffectiveEmbeddingBatchSize({
        configuredBatchSize: 8,
        model: 'text-embedding-v4',
        provider: 'qwen',
      }),
    ).toBe(8);
  });

  it('does not change other provider/model combinations', () => {
    expect(
      getEffectiveEmbeddingBatchSize({
        configuredBatchSize: 50,
        model: 'text-embedding-3-small',
        provider: 'openai',
      }),
    ).toBe(50);
  });
});
