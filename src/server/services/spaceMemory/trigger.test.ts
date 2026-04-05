import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpaceMemoryTriggerService } from './trigger';

const originalAppUrl = process.env.APP_URL;
const originalInternalAppUrl = process.env.INTERNAL_APP_URL;
const originalKeyVaultsSecret = process.env.KEY_VAULTS_SECRET;
const originalVercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

describe('SpaceMemoryTriggerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
      }),
    );
    process.env.APP_URL = 'https://app.example.com';
    process.env.INTERNAL_APP_URL = 'https://internal.example.com';
    process.env.KEY_VAULTS_SECRET = 'internal-secret';
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }

    if (originalInternalAppUrl === undefined) {
      delete process.env.INTERNAL_APP_URL;
    } else {
      process.env.INTERNAL_APP_URL = originalInternalAppUrl;
    }

    if (originalKeyVaultsSecret === undefined) {
      delete process.env.KEY_VAULTS_SECRET;
    } else {
      process.env.KEY_VAULTS_SECRET = originalKeyVaultsSecret;
    }

    if (originalVercelBypassSecret === undefined) {
      delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    } else {
      process.env.VERCEL_AUTOMATION_BYPASS_SECRET = originalVercelBypassSecret;
    }
  });

  it('posts harness intake payloads to the internal webhook', async () => {
    await SpaceMemoryTriggerService.triggerHarnessIngest({
      adapter: 'ops-harness-v1',
      drafts: [
        {
          kind: 'playbook',
          sourceRefs: [{ objectId: 'topic_1', objectType: 'topic', title: 'Rollout topic' }],
          title: 'Ops memory',
        },
      ],
      producer: 'custom-harness',
      spaceId: 'spc_team',
      traceId: 'trace-1',
      userId: 'user-1',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://internal.example.com/api/webhooks/space-memory-ingest',
      expect.objectContaining({
        body: JSON.stringify({
          adapter: 'ops-harness-v1',
          drafts: [
            {
              kind: 'playbook',
              sourceRefs: [{ objectId: 'topic_1', objectType: 'topic', title: 'Rollout topic' }],
              title: 'Ops memory',
            },
          ],
          producer: 'custom-harness',
          spaceId: 'spc_team',
          traceId: 'trace-1',
          userId: 'user-1',
        }),
        headers: expect.objectContaining({
          'Authorization': 'Bearer internal-secret',
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      }),
    );
  });

  it('uses explicit baseUrl when provided', async () => {
    await SpaceMemoryTriggerService.triggerHarnessIngest({
      baseUrl: 'https://worker.example.com',
      drafts: [
        {
          sourceRefs: [{ objectId: 'doc_1', objectType: 'doc', title: 'Runbook' }],
          title: 'Ops memory',
        },
      ],
      spaceId: 'spc_team',
      userId: 'user-1',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://worker.example.com/api/webhooks/space-memory-ingest',
      expect.any(Object),
    );
  });
});
