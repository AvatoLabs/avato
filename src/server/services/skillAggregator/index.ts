import { ssrfSafeFetch } from '@lobechat/ssrf-safe-fetch';

import {
  isSkillAggregatorInstallable,
  SKILL_AGGREGATOR_ALL_SOURCE,
  type SkillAggregatorCollection,
  type SkillAggregatorInstallability,
  SkillAggregatorInstallabilityLevel,
  SkillAggregatorInstallabilityReason,
  type SkillAggregatorItem,
  type SkillAggregatorListResponse,
  type SkillAggregatorQueryParams,
  SkillAggregatorSorts,
  SkillAggregatorSource,
} from '../../../types/skillAggregator';
import { SkillManifestError, SkillParseError } from '../skill/errors';
import { SkillParser } from '../skill/parser';

const LIGHTMAKE_LIST_URL = 'https://lightmake.site/api/skills';
const LIGHTMAKE_TOP_URL = 'https://lightmake.site/api/skills/top';
const LIGHTMAKE_DOWNLOAD_URL = 'https://lightmake.site/api/v1/download';

const DEFAULT_PAGE_SIZE = 21;
const MAX_PAGE_SIZE = 60;
const MAX_SKILL_PACKAGE_BYTES = 10 * 1024 * 1024;
const VERIFICATION_CONCURRENCY = 4;
const MAX_FETCH_ATTEMPTS = 3;
const LIGHT_VERIFICATION_BYTES = 1024;

interface LightmakeSkillItem {
  category?: string;
  description?: string;
  description_zh?: string;
  downloads?: number;
  homepage?: string;
  installs?: number;
  name?: string;
  ownerName?: string;
  score?: number;
  slug?: string;
  stars?: number;
  tags?: string[] | null;
  updated_at?: number;
  version?: string;
}

interface LightmakeListResponse {
  code: number;
  data?: {
    skills?: LightmakeSkillItem[];
    total?: number;
  };
  message?: string;
}

interface SkillAggregatorMeta {
  allCount: number;
  curatedCount: number;
  sourceCounts: SkillAggregatorCollection['sourceCounts'];
}

const formatUpdatedAt = (timestamp?: number) => {
  if (!timestamp) return undefined;

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown skill aggregator source error';

const mapSortToLightmake = (sort?: SkillAggregatorSorts) => {
  switch (sort) {
    case SkillAggregatorSorts.Downloads: {
      return { order: 'desc', sortBy: 'downloads' };
    }
    case SkillAggregatorSorts.InstallCount: {
      return { order: 'desc', sortBy: 'installs' };
    }
    case SkillAggregatorSorts.Name: {
      return { order: 'desc', sortBy: 'name' };
    }
    case SkillAggregatorSorts.Stars: {
      return { order: 'desc', sortBy: 'stars' };
    }
    case SkillAggregatorSorts.UpdatedAt: {
      return { order: 'desc', sortBy: 'updated_at' };
    }
    case SkillAggregatorSorts.Relevance:
    default: {
      return { order: 'desc', sortBy: 'score' };
    }
  }
};

const toInitialInstallability = (importUrl?: string): SkillAggregatorInstallability => {
  if (!importUrl) {
    return { level: SkillAggregatorInstallabilityLevel.Discoverable };
  }

  return { level: SkillAggregatorInstallabilityLevel.Importable };
};

const toItem = (item: LightmakeSkillItem): SkillAggregatorItem => {
  const slug = item.slug || 'unknown-skill';
  const owner = item.ownerName || 'unknown';
  const importIdentifier = `skillhub.${owner}.${slug}`;
  const importUrl = `${LIGHTMAKE_DOWNLOAD_URL}?slug=${encodeURIComponent(slug)}`;

  return {
    category: item.category,
    description: item.description_zh || item.description || '',
    downloadCount: item.downloads,
    homepage: item.homepage,
    id: importIdentifier,
    identifier: `${owner}/${slug}`,
    importIdentifier,
    importUrl,
    installCount: item.installs,
    installability: toInitialInstallability(importUrl),
    ownerName: item.ownerName,
    slug,
    sourceLinks: [
      {
        source: SkillAggregatorSource.SkillHub,
        url: item.homepage || importUrl,
      },
    ],
    sources: [SkillAggregatorSource.SkillHub],
    starCount: item.stars,
    tags: item.tags || [],
    title: item.name || slug,
    updatedAt: formatUpdatedAt(item.updated_at),
    version: item.version,
  };
};

export class SkillAggregatorService {
  private parser = new SkillParser();

  private isRetryableFetchError(error: unknown): boolean {
    const message = toErrorMessage(error).toLowerCase();

    const failedToFetchStatus = message.match(/failed to fetch .*: (\d{3})/);
    if (failedToFetchStatus) {
      const status = Number(failedToFetchStatus[1]);
      return status >= 500 || status === 408 || status === 429;
    }

    return [
      'socket hang up',
      'network error',
      'fetch failed',
      'econnreset',
      'econnrefused',
      'etimedout',
      'timeout',
      'temporary failure',
      'temporarily unavailable',
      'connection aborted',
      'request aborted',
    ].some((pattern) => message.includes(pattern));
  }

  private async retryFetch<T>(fetcher: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
      try {
        return await fetcher();
      } catch (error) {
        lastError = error;
        if (attempt >= MAX_FETCH_ATTEMPTS || !this.isRetryableFetchError(error)) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private async fetchJson<T>(url: string) {
    return this.retryFetch(async () => {
      const response = await ssrfSafeFetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    });
  }

  private isZipResponse(url: string, contentType: string) {
    const pathname = new URL(url).pathname;

    return (
      pathname.endsWith('.zip') ||
      pathname.includes('/download') ||
      contentType.includes('application/zip') ||
      contentType.includes('application/octet-stream')
    );
  }

  private isZipSignature(buffer: Buffer): boolean {
    return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  }

  private getTotalSizeFromContentRange(header: string | null): number | null {
    if (!header) return null;

    const match = header.match(/bytes \d+-\d+\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  private async verifyInstallability(
    item: SkillAggregatorItem,
  ): Promise<SkillAggregatorInstallability> {
    if (!item.importUrl) {
      return {
        level: SkillAggregatorInstallabilityLevel.Discoverable,
        reason: SkillAggregatorInstallabilityReason.DownloadUnavailable,
      };
    }

    try {
      const response = await this.retryFetch(async () =>
        ssrfSafeFetch(item.importUrl!, {
          headers: {
            Accept:
              'application/zip, application/octet-stream, text/markdown;q=0.9, text/plain;q=0.8',
            Range: `bytes=0-${LIGHT_VERIFICATION_BYTES - 1}`,
          },
        }),
      );

      if (!response.ok && response.status !== 206) {
        return {
          level: SkillAggregatorInstallabilityLevel.Importable,
          reason: SkillAggregatorInstallabilityReason.FetchFailed,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      const contentLength = Number(response.headers.get('content-length') || 0);
      const contentRange = response.headers.get('content-range');
      const totalSize = this.getTotalSizeFromContentRange(contentRange) ?? contentLength;

      if (Number.isFinite(totalSize) && totalSize > 0 && totalSize > MAX_SKILL_PACKAGE_BYTES) {
        return {
          level: SkillAggregatorInstallabilityLevel.Importable,
          reason: SkillAggregatorInstallabilityReason.PackageTooLarge,
        };
      }

      if (this.isZipResponse(item.importUrl, contentType)) {
        const buffer = Buffer.from(await response.arrayBuffer());

        if (!this.isZipSignature(buffer)) {
          return {
            level: SkillAggregatorInstallabilityLevel.Importable,
            reason: SkillAggregatorInstallabilityReason.InvalidPackage,
          };
        }

        if (buffer.length > MAX_SKILL_PACKAGE_BYTES) {
          return {
            level: SkillAggregatorInstallabilityLevel.Importable,
            reason: SkillAggregatorInstallabilityReason.PackageTooLarge,
          };
        }

        if (buffer.length <= LIGHT_VERIFICATION_BYTES) {
          return {
            level: SkillAggregatorInstallabilityLevel.Verified,
            validatedAt: new Date().toISOString(),
          };
        }

        await this.parser.parseZipPackage(buffer);
      } else {
        const content = await response.text();
        this.parser.parseSkillMd(content);
      }

      return {
        level: SkillAggregatorInstallabilityLevel.Verified,
        validatedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof SkillParseError || error instanceof SkillManifestError) {
        return {
          level: SkillAggregatorInstallabilityLevel.Importable,
          reason: SkillAggregatorInstallabilityReason.InvalidPackage,
        };
      }

      return {
        level: SkillAggregatorInstallabilityLevel.Importable,
        reason: SkillAggregatorInstallabilityReason.FetchFailed,
      };
    }
  }

  private async verifyItem(item: SkillAggregatorItem): Promise<SkillAggregatorItem> {
    return {
      ...item,
      installability: await this.verifyInstallability(item),
    };
  }

  private async verifyItems(items: SkillAggregatorItem[]) {
    const results: SkillAggregatorItem[] = Array.from({ length: items.length });
    let nextIndex = 0;
    const workerCount = Math.min(VERIFICATION_CONCURRENCY, items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (true) {
          const currentIndex = nextIndex++;

          if (currentIndex >= items.length) return;

          results[currentIndex] = await this.verifyItem(items[currentIndex]);
        }
      }),
    );

    return results;
  }

  private async fetchLightmakeList(params: URLSearchParams) {
    const response = await this.fetchJson<LightmakeListResponse>(
      `${LIGHTMAKE_LIST_URL}?${params.toString()}`,
    );

    if (response.code !== 0) {
      throw new Error(response.message || 'SkillHub API returned a non-zero status');
    }

    return response.data || {};
  }

  async fetchMeta(): Promise<SkillAggregatorMeta> {
    const [listResult, curatedResult] = await Promise.allSettled([
      this.fetchLightmakeList(
        new URLSearchParams({
          page: '1',
          pageSize: '1',
          sortBy: 'score',
          order: 'desc',
        }),
      ),
      this.fetchJson<LightmakeListResponse>(LIGHTMAKE_TOP_URL),
    ]);

    const allCount = listResult.status === 'fulfilled' ? listResult.value.total || 0 : 0;
    const curatedCount =
      curatedResult.status === 'fulfilled'
        ? curatedResult.value.data?.total || curatedResult.value.data?.skills?.length || 0
        : 0;

    return {
      allCount,
      curatedCount,
      sourceCounts: [
        {
          count: allCount,
          source: SkillAggregatorSource.SkillHub,
        },
      ],
    };
  }

  async fetchEntries(
    params: SkillAggregatorQueryParams,
    meta: SkillAggregatorMeta,
  ): Promise<SkillAggregatorListResponse> {
    const pageSize = Math.min(Math.max(params.pageSize || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const currentPage = Math.max(params.page || 1, 1);
    const source = params.source || SKILL_AGGREGATOR_ALL_SOURCE;
    const warnings: SkillAggregatorCollection['warnings'] = [];

    if (source !== SKILL_AGGREGATOR_ALL_SOURCE && source !== SkillAggregatorSource.SkillHub) {
      return {
        allCount: meta.allCount,
        currentPage: 1,
        fetchedAt: new Date().toISOString(),
        items: [],
        pageSize,
        sourceCounts: meta.sourceCounts,
        stats: {
          curatedCount: meta.curatedCount,
          verifiedCount: 0,
        },
        totalCount: 0,
        totalPages: 1,
        warnings,
      };
    }

    try {
      const searchParams = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
      });
      const sortConfig = mapSortToLightmake(params.sort);

      searchParams.set('sortBy', sortConfig.sortBy);
      searchParams.set('order', sortConfig.order);

      if (params.q?.trim()) searchParams.set('keyword', params.q.trim());

      const response = await this.fetchLightmakeList(searchParams);
      const items = await this.verifyItems((response.skills || []).map(toItem));
      const totalCount = response.total || 0;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const verifiedCount = items.filter(({ installability }) =>
        isSkillAggregatorInstallable(installability),
      ).length;

      return {
        allCount: meta.allCount,
        currentPage: Math.min(currentPage, totalPages),
        fetchedAt: new Date().toISOString(),
        items,
        pageSize,
        sourceCounts: meta.sourceCounts,
        stats: {
          curatedCount: meta.curatedCount,
          verifiedCount,
        },
        totalCount,
        totalPages,
        warnings,
      };
    } catch (error) {
      warnings.push({
        message: toErrorMessage(error),
        source: SkillAggregatorSource.SkillHub,
      });

      return {
        allCount: meta.allCount,
        currentPage: 1,
        fetchedAt: new Date().toISOString(),
        items: [],
        pageSize,
        sourceCounts: meta.sourceCounts,
        stats: {
          curatedCount: meta.curatedCount,
          verifiedCount: 0,
        },
        totalCount: 0,
        totalPages: 1,
        warnings,
      };
    }
  }
}

export const skillAggregatorService = new SkillAggregatorService();
