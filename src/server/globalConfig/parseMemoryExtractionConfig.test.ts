import { afterEach, describe, expect, it } from 'vitest';

import { parseMemoryExtractionConfig } from './parseMemoryExtractionConfig';

const originalAllowInsecureDev = process.env.MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV;

afterEach(() => {
  if (originalAllowInsecureDev === undefined) {
    delete process.env.MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV;
  } else {
    process.env.MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV = originalAllowInsecureDev;
  }
});

describe('parseMemoryExtractionConfig', () => {
  it('defaults webhook.allowInsecureDev to false', () => {
    delete process.env.MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV;

    expect(parseMemoryExtractionConfig().webhook.allowInsecureDev).toBe(false);
  });

  it('parses webhook.allowInsecureDev from env', () => {
    process.env.MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV = 'true';

    expect(parseMemoryExtractionConfig().webhook.allowInsecureDev).toBe(true);
  });

  it('treats 1 as a truthy webhook.allowInsecureDev value', () => {
    process.env.MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV = '1';

    expect(parseMemoryExtractionConfig().webhook.allowInsecureDev).toBe(true);
  });
});
