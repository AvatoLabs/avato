import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryExtractionTriggerService } from '../extract';

const originalKeyVaultsSecret = process.env.KEY_VAULTS_SECRET;
const originalWebhookHeaders = process.env.MEMORY_USER_MEMORY_WEBHOOK_HEADERS;
const originalVercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

describe('MemoryExtractionTriggerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalKeyVaultsSecret === undefined) {
      delete process.env.KEY_VAULTS_SECRET;
    } else {
      process.env.KEY_VAULTS_SECRET = originalKeyVaultsSecret;
    }

    if (originalWebhookHeaders === undefined) {
      delete process.env.MEMORY_USER_MEMORY_WEBHOOK_HEADERS;
    } else {
      process.env.MEMORY_USER_MEMORY_WEBHOOK_HEADERS = originalWebhookHeaders;
    }

    if (originalVercelBypassSecret === undefined) {
      delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    } else {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = originalVercelBypassSecret;
    }
  });

  it('adds internal service auth when no explicit authorization header is configured', async () => {
    process.env.KEY_VAULTS_SECRET = 'internal-secret';
    delete process.env.MEMORY_USER_MEMORY_WEBHOOK_HEADERS;
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    await MemoryExtractionTriggerService.triggerProcessUsers({
      baseUrl: 'https://example.com',
    } as any);

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/webhooks/memory-extraction',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer internal-secret',
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      }),
    );
  });

  it('keeps configured authorization headers untouched', async () => {
    process.env.KEY_VAULTS_SECRET = 'internal-secret';
    process.env.MEMORY_USER_MEMORY_WEBHOOK_HEADERS = 'Authorization=Bearer external-secret';

    await MemoryExtractionTriggerService.triggerProcessUsers({
      baseUrl: 'https://example.com',
    } as any);

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/webhooks/memory-extraction',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer external-secret',
        }),
      }),
    );
  });
});
