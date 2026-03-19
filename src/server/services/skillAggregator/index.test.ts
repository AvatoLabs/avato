// @vitest-environment node
import { zip } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SkillAggregatorInstallabilityLevel,
  SkillAggregatorInstallabilityReason,
  SkillAggregatorSorts,
  SkillAggregatorSource,
} from '../../../types/skillAggregator';
import { SkillAggregatorService } from './index';

const { mockSsrfSafeFetch } = vi.hoisted(() => ({
  mockSsrfSafeFetch: vi.fn(),
}));

vi.mock('@lobechat/ssrf-safe-fetch', () => ({
  ssrfSafeFetch: mockSsrfSafeFetch,
}));

const createZip = (files: Record<string, Uint8Array>): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    zip(files, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });

const createJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
  });

describe('SkillAggregatorService', () => {
  const service = new SkillAggregatorService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies downloadable skill packages before marking them installable', async () => {
    const validZip = Buffer.from(
      await createZip({
        'SKILL.md': new TextEncoder().encode(`---
name: verified-skill
description: Verified skill package
---
This package can be imported.`),
      }),
    );

    mockSsrfSafeFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('https://lightmake.site/api/skills')) {
        return createJsonResponse({
          code: 0,
          data: {
            skills: [
              {
                description: 'Verified package',
                name: 'Verified Skill',
                ownerName: 'lobehub',
                slug: 'verified-skill',
              },
              {
                description: 'Broken package',
                name: 'Broken Skill',
                ownerName: 'lobehub',
                slug: 'broken-skill',
              },
            ],
            total: 2,
          },
        });
      }

      if (url.includes('slug=verified-skill')) {
        return new Response(validZip, {
          headers: {
            'content-type': 'application/zip',
          },
          status: 200,
        });
      }

      if (url.includes('slug=broken-skill')) {
        return new Response(Buffer.from('not-a-zip-package'), {
          headers: {
            'content-type': 'application/zip',
          },
          status: 200,
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.fetchEntries(
      { page: 1, pageSize: 2, sort: SkillAggregatorSorts.Relevance },
      {
        allCount: 2,
        curatedCount: 1,
        sourceCounts: [{ count: 2, source: SkillAggregatorSource.SkillHub }],
      },
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0].installability.level).toBe(SkillAggregatorInstallabilityLevel.Verified);
    expect(result.items[1].installability).toEqual({
      level: SkillAggregatorInstallabilityLevel.Importable,
      reason: SkillAggregatorInstallabilityReason.InvalidPackage,
    });
    expect(result.stats.verifiedCount).toBe(1);
  });

  it('keeps import disabled when the downloadable package cannot be fetched', async () => {
    mockSsrfSafeFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('https://lightmake.site/api/skills')) {
        return createJsonResponse({
          code: 0,
          data: {
            skills: [
              {
                description: 'Package fetch failure',
                name: 'Fetch Failure',
                ownerName: 'lobehub',
                slug: 'fetch-failure',
              },
            ],
            total: 1,
          },
        });
      }

      if (url.includes('slug=fetch-failure')) {
        return new Response('upstream unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.fetchEntries(
      { page: 1, pageSize: 1, sort: SkillAggregatorSorts.Relevance },
      {
        allCount: 1,
        curatedCount: 0,
        sourceCounts: [{ count: 1, source: SkillAggregatorSource.SkillHub }],
      },
    );

    expect(result.items[0].installability).toEqual({
      level: SkillAggregatorInstallabilityLevel.Importable,
      reason: SkillAggregatorInstallabilityReason.FetchFailed,
    });
    expect(result.stats.verifiedCount).toBe(0);
  });
});
