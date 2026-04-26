import { createHash } from 'node:crypto';

import { ssrfSafeFetch } from '@lobechat/ssrf-safe-fetch';

import {
  AGGREGATOR_ALL_SOURCE,
  type AggregatorCollection,
  type AggregatorInstallability,
  AggregatorInstallabilityLevel,
  AggregatorInstallabilityReason,
  type AggregatorItem,
  type AggregatorListResponse,
  type AggregatorQueryParams,
  AggregatorSorts,
  AggregatorSource,
  isAggregatorInstallable,
} from '../../../types/aggregator';
import { mcpService } from '../mcp';

const OFFICIAL_REGISTRY_URL = 'https://registry.modelcontextprotocol.io/v0.1/servers';
const SMITHERY_REGISTRY_URL = 'https://api.smithery.ai/servers';
const GLAMA_REGISTRY_URL = 'https://glama.ai/api/mcp/v1/servers';
const HIGRESS_MARKET_URL = 'https://mcp.higress.ai';

const DEFAULT_PAGE_SIZE = 21;
const MAX_PAGE_SIZE = 60;
const SOURCE_PAGE_SIZE = 100;
const DEFAULT_MAX_SOURCE_REQUESTS = 2;
const DEFAULT_MAX_HIGRESS_PAGES = 24;
const MAX_FETCH_ATTEMPTS = 3;
const SOURCE_FETCH_TIMEOUT = 25_000;
const INSTALL_VERIFICATION_CONCURRENCY = 4;
const INSTALL_VERIFICATION_TIMEOUT = 8000;
const SOURCE_PRIORITY = [
  AggregatorSource.Official,
  AggregatorSource.Higress,
  AggregatorSource.Smithery,
  AggregatorSource.Glama,
] as const;

interface OfficialRegistryResponse {
  metadata?: {
    nextCursor?: string;
  };
  servers?: Array<{
    _meta?: {
      'io.modelcontextprotocol.registry/official'?: {
        isLatest?: boolean;
        status?: string;
        updatedAt?: string;
      };
    };
    server?: {
      description?: string;
      icons?: Array<{ src?: string }>;
      name?: string;
      packages?: Array<{
        transport?: {
          type?: string;
        };
      }>;
      repository?: {
        url?: string;
      };
      title?: string;
      websiteUrl?: string;
      remotes?: Array<{
        type?: string;
        url?: string;
      }>;
    };
  }>;
}

interface SmitheryRegistryResponse {
  pagination?: {
    totalCount?: number;
  };
  servers?: Array<{
    createdAt?: string;
    description?: string;
    displayName?: string;
    homepage?: string;
    iconUrl?: string;
    namespace?: string;
    qualifiedName?: string;
    remote?: boolean;
    score?: number | null;
    useCount?: number;
    verified?: boolean;
  }>;
}

interface GlamaRegistryResponse {
  pageInfo?: {
    endCursor?: string;
    hasNextPage?: boolean;
  };
  servers?: Array<{
    attributes?: string[];
    description?: string;
    environmentVariablesJsonSchema?: {
      properties?: Record<string, unknown>;
    };
    id?: string;
    name?: string;
    namespace?: string;
    repository?: {
      url?: string;
    };
    slug?: string;
    tools?: unknown[];
    url?: string;
  }>;
}

interface HigressRegistryEntry {
  description: string;
  icon?: string;
  installUrl?: string;
  installUrlRequiresConfig: boolean;
  pageId: string;
  repositorySlug: string;
  title: string;
  updatedAt?: string;
}

interface AggregatorCandidate {
  badges: string[];
  createdAt?: string;
  description: string;
  homepage?: string;
  icon?: string;
  identifier: string;
  installCount?: number;
  installUrl?: string;
  isOfficial: boolean;
  isRemote: boolean;
  isVerified: boolean;
  popularity: number;
  repositoryUrl?: string;
  score: number;
  source: AggregatorSource;
  sourceLink?: string;
  starCount?: number;
  title: string;
  toolCount?: number;
  transportTypes: string[];
  updatedAt?: string;
}

const parseDate = (value?: string) => {
  if (!value) return 0;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const normalizeText = (value?: string) => (value || '').trim().toLowerCase();

const normalizeUrl = (value?: string) => {
  if (!value) return undefined;

  return value
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .toLowerCase();
};

const uniq = (values: Array<string | undefined>) => [
  ...new Set(values.filter(Boolean).map((value) => value!.trim())),
];

const MIN_QUERY_LENGTH = 2;

const getPositiveIntegerEnv = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] || '', 10);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getMaxSourceRequests = () =>
  getPositiveIntegerEnv('AGGREGATOR_MAX_SOURCE_REQUESTS', DEFAULT_MAX_SOURCE_REQUESTS);

const getMaxHigressPages = () =>
  getPositiveIntegerEnv('AGGREGATOR_MAX_HIGRESS_PAGES', DEFAULT_MAX_HIGRESS_PAGES);

const includesQuery = (item: AggregatorCandidate | AggregatorItem, query?: string) => {
  if (!query) return true;

  const searchValue = normalizeText(query);
  if (searchValue.length < MIN_QUERY_LENGTH) return true;
  const haystack = [
    item.title,
    item.description,
    item.identifier,
    item.homepage,
    item.repositoryUrl,
    ...item.badges,
    ...item.transportTypes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(searchValue);
};

const computePopularity = ({
  installCount,
  score,
  starCount,
  toolCount,
}: Pick<AggregatorCandidate, 'installCount' | 'score' | 'starCount' | 'toolCount'>) => {
  return (
    (installCount || 0) +
    (starCount || 0) * 8 +
    (toolCount || 0) * 10 +
    Math.round((score || 0) * 1000)
  );
};

const computeScore = (candidate: Omit<AggregatorCandidate, 'popularity' | 'score'>) => {
  const recencyScore = parseDate(candidate.updatedAt || candidate.createdAt)
    ? Math.max(
        0,
        180 -
          Math.floor(
            (Date.now() - parseDate(candidate.updatedAt || candidate.createdAt)) / 86_400_000,
          ),
      )
    : 0;

  return (
    (candidate.isOfficial ? 1200 : 0) +
    (candidate.isVerified ? 240 : 0) +
    (candidate.isRemote ? 40 : 0) +
    candidate.transportTypes.length * 15 +
    candidate.badges.length * 5 +
    recencyScore
  );
};

const withMetrics = (
  candidate: Omit<AggregatorCandidate, 'popularity' | 'score'>,
): AggregatorCandidate => {
  const score = computeScore(candidate);
  const popularity = computePopularity({
    installCount: candidate.installCount,
    score,
    starCount: candidate.starCount,
    toolCount: candidate.toolCount,
  });

  return {
    ...candidate,
    popularity,
    score: score + popularity / 100,
  };
};

const buildDedupeKey = (candidate: AggregatorCandidate) => {
  return (
    normalizeUrl(candidate.repositoryUrl) ||
    normalizeUrl(candidate.homepage) ||
    `${normalizeText(candidate.title)}::${normalizeText(candidate.identifier)}`
  );
};

const getPrimarySource = (sources: AggregatorSource[]) => {
  return (
    SOURCE_PRIORITY.find((source) => sources.includes(source)) ||
    sources[0] ||
    AggregatorSource.Official
  );
};

const buildInstallIdentifier = (identifier: string, installUrl: string) => {
  const normalized = identifier
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 48);
  const digest = createHash('sha256')
    .update(`${identifier}:${installUrl}`)
    .digest('hex')
    .slice(0, 8);

  return `aggregator.${normalized || 'mcp'}-${digest}`;
};

const createInitialInstallability = (
  candidate: Pick<
    AggregatorCandidate,
    | 'createdAt'
    | 'description'
    | 'homepage'
    | 'icon'
    | 'identifier'
    | 'installUrl'
    | 'isRemote'
    | 'title'
    | 'updatedAt'
  >,
) => {
  if (!candidate.isRemote) {
    return {
      level: AggregatorInstallabilityLevel.Discoverable,
      reason: AggregatorInstallabilityReason.NotRemote,
    } satisfies AggregatorInstallability;
  }

  if (!candidate.installUrl) {
    return {
      level: AggregatorInstallabilityLevel.Discoverable,
      reason: AggregatorInstallabilityReason.MissingConnection,
    } satisfies AggregatorInstallability;
  }

  if (isTemplateUrl(candidate.installUrl)) {
    return {
      installSchema: {
        author: 'MCP Aggregator',
        config: {
          type: 'http',
          url: candidate.installUrl,
        },
        description: candidate.description,
        homepage: candidate.homepage,
        icon: candidate.icon,
        identifier: buildInstallIdentifier(candidate.identifier, candidate.installUrl),
        name: candidate.title,
        version: candidate.updatedAt || candidate.createdAt || 'latest',
      },
      level: AggregatorInstallabilityLevel.Discoverable,
      reason: AggregatorInstallabilityReason.ConfigRequired,
    } satisfies AggregatorInstallability;
  }

  return {
    installSchema: {
      author: 'MCP Aggregator',
      config: {
        type: 'http',
        url: candidate.installUrl,
      },
      description: candidate.description,
      homepage: candidate.homepage,
      icon: candidate.icon,
      identifier: buildInstallIdentifier(candidate.identifier, candidate.installUrl),
      name: candidate.title,
      version: candidate.updatedAt || candidate.createdAt || 'latest',
    },
    level: AggregatorInstallabilityLevel.Installable,
  } satisfies AggregatorInstallability;
};

const sortItems = (items: AggregatorItem[], sort = AggregatorSorts.Relevance) => {
  return [...items].sort((left, right) => {
    switch (sort) {
      case AggregatorSorts.Name: {
        return left.title.localeCompare(right.title);
      }
      case AggregatorSorts.Popularity: {
        return (
          (right.popularity || 0) - (left.popularity || 0) ||
          right.score - left.score ||
          left.title.localeCompare(right.title)
        );
      }
      case AggregatorSorts.UpdatedAt: {
        return (
          parseDate(right.updatedAt || right.createdAt) -
            parseDate(left.updatedAt || left.createdAt) ||
          right.score - left.score ||
          left.title.localeCompare(right.title)
        );
      }
      case AggregatorSorts.Relevance:
      default: {
        return right.score - left.score || left.title.localeCompare(right.title);
      }
    }
  });
};

const paginateItems = (
  items: AggregatorItem[],
  params: AggregatorQueryParams,
): AggregatorListResponse => {
  const pageSize = Math.min(Math.max(params.pageSize || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const currentPage = Math.max(params.page || 1, 1);
  const offset = (currentPage - 1) * pageSize;
  const pagedItems = items.slice(offset, offset + pageSize);
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    allCount: items.length,
    currentPage: Math.min(currentPage, totalPages),
    fetchedAt: new Date().toISOString(),
    items: pagedItems,
    pageSize,
    sourceCounts: [],
    stats: {
      installableCount: 0,
      officialCount: 0,
      remoteCount: 0,
      verifiedCount: 0,
    },
    totalCount,
    totalPages,
    warnings: [],
  };
};

const buildListResponse = (
  collection: AggregatorCollection,
  params: AggregatorQueryParams,
): AggregatorListResponse => {
  const source = params.source || AGGREGATOR_ALL_SOURCE;
  const filtered = collection.items.filter((item) => {
    if (source !== AGGREGATOR_ALL_SOURCE && !item.sources.includes(source)) return false;
    if (params.q && !includesQuery(item, params.q)) return false;

    return true;
  });
  const sorted = sortItems(filtered, params.sort);
  const paginated = paginateItems(sorted, params);
  const stats = {
    installableCount: filtered.filter((item) => isAggregatorInstallable(item.installability))
      .length,
    officialCount: filtered.filter((item) => item.isOfficial).length,
    remoteCount: filtered.filter((item) => item.isRemote).length,
    verifiedCount: filtered.filter((item) => item.isVerified).length,
  };

  return {
    ...paginated,
    allCount: collection.allCount,
    fetchedAt: collection.fetchedAt,
    sourceCounts: collection.sourceCounts,
    stats,
    warnings: collection.warnings,
  };
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown aggregator source error';

const isRetryableFetchError = (error: unknown) => {
  const message = toErrorMessage(error).toLowerCase();

  if (
    message.includes('private ip address') ||
    message.includes('meta ip address') ||
    message.includes(' is not allowed. because')
  ) {
    return false;
  }

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
    'eai_again',
    'temporary failure',
    'temporarily unavailable',
    'connection aborted',
    'request aborted',
  ].some((pattern) => message.includes(pattern));
};

const withSourceTimeout = <T>(source: AggregatorSource, promise: Promise<T>) =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${source} registry refresh timed out after 25s`)),
        SOURCE_FETCH_TIMEOUT,
      );
    }),
  ]);

const HIGRESS_PAGE_ID_PATTERN = /\/server\/(server\d+)/g;
const HIGRESS_REPOSITORY_PATTERN =
  /https:\/\/github\.com\/alibaba\/higress\/tree\/main\/plugins\/wasm-go\/mcp-servers\/([^\\/"'<\s]+)/;
const HIGRESS_SERVER_NAME_PATTERN = /serverName\\":\\"([^"]+)\\"/;
const HIGRESS_DESCRIPTION_PATTERN = /text-sm text-muted-foreground\\",\\"children\\":\\"([^"]+)\\"/;
const HIGRESS_ICON_PATTERN = /"src":"(https:\/\/img\.alicdn\.com\/[^"]+)"/;
const HIGRESS_UPDATED_PATTERN = /(\d{4}\.\d{2}\.\d{2})\\",\\" \\",\\"updated\\"/;
const HIGRESS_INSTALL_URL_PATTERN = /https:\/\/mcp\.higress\.ai\/mcp-[^"'<\s]+/g;

const decodeEscapedText = (value?: string) => {
  if (!value) return '';

  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('\\u0026', '&')
    .replaceAll('\\"', '"')
    .replaceAll('\\n', ' ')
    .replaceAll('\\\\', '\\')
    .trim();
};

const isTemplateUrl = (url: string) => /[{}]/.test(url);
const normalizeHigressInstallUrl = (value?: string) =>
  decodeEscapedText(value)
    .replaceAll(/^"+|"+$/g, '')
    .replaceAll(/\\+$/g, '')
    .trim();

export class AggregatorService {
  private async retrySourceFetch<T>(fetcher: () => Promise<T>) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
      try {
        return await fetcher();
      } catch (error) {
        lastError = error;

        if (attempt >= MAX_FETCH_ATTEMPTS || !isRetryableFetchError(error)) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private async verifyInstallability(item: AggregatorItem): Promise<AggregatorInstallability> {
    const installSchema = item.installability.installSchema;

    if (!isAggregatorInstallable(item.installability)) {
      return item.installability;
    }

    if (!item.isRemote) {
      return {
        level: AggregatorInstallabilityLevel.Discoverable,
        reason: AggregatorInstallabilityReason.NotRemote,
      };
    }

    if (!installSchema?.config.url) {
      return {
        level: AggregatorInstallabilityLevel.Discoverable,
        reason: AggregatorInstallabilityReason.MissingConnection,
      };
    }

    try {
      await Promise.race([
        mcpService.getStreamableMcpServerManifest(
          installSchema.identifier,
          installSchema.config.url,
          {
            avatar: item.icon,
            description: item.description,
            name: item.title,
          },
        ),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Manifest verification timed out')),
            INSTALL_VERIFICATION_TIMEOUT,
          ),
        ),
      ]);

      return {
        ...item.installability,
        level: AggregatorInstallabilityLevel.Verified,
        validatedAt: new Date().toISOString(),
      };
    } catch {
      return {
        ...item.installability,
        level: AggregatorInstallabilityLevel.Discoverable,
        reason: AggregatorInstallabilityReason.VerificationFailed,
      };
    }
  }

  private async verifyItem(item: AggregatorItem): Promise<AggregatorItem> {
    return {
      ...item,
      installability: await this.verifyInstallability(item),
    };
  }

  private async verifyItems(items: AggregatorItem[]) {
    const results: AggregatorItem[] = Array.from({ length: items.length });
    let nextIndex = 0;
    const workerCount = Math.min(INSTALL_VERIFICATION_CONCURRENCY, items.length);

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

  private async fetchJson<T>(url: string) {
    return this.retrySourceFetch(async () => {
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

  private async fetchText(url: string) {
    return this.retrySourceFetch(async () => {
      const response = await ssrfSafeFetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }

      return response.text();
    });
  }

  private parseHigressEntry(pageId: string, html: string): HigressRegistryEntry | undefined {
    const repositoryMatch = html.match(HIGRESS_REPOSITORY_PATTERN);
    const repositorySlug = repositoryMatch?.[1];

    if (!repositorySlug) return;

    const title =
      decodeEscapedText(html.match(HIGRESS_SERVER_NAME_PATTERN)?.[1]) ||
      repositorySlug.replace(/^mcp-/, '').replaceAll('-', ' ');

    const description =
      decodeEscapedText(html.match(HIGRESS_DESCRIPTION_PATTERN)?.[1]) ||
      `Hosted MCP server from Higress Marketplace: ${repositorySlug}`;
    const icon = html.match(HIGRESS_ICON_PATTERN)?.[1];
    const updatedDate = html.match(HIGRESS_UPDATED_PATTERN)?.[1];
    const installUrls = uniq(
      [...html.matchAll(HIGRESS_INSTALL_URL_PATTERN)]
        .map((match) => normalizeHigressInstallUrl(match[0]))
        .filter(Boolean),
    );
    const preferredInstallUrls = installUrls
      .filter((url) => url.includes(`/mcp-${repositorySlug.replace(/^mcp-/, '')}`))
      .sort(
        (left, right) =>
          Number(right.endsWith('/sse')) - Number(left.endsWith('/sse')) ||
          right.length - left.length,
      );
    const installUrl = preferredInstallUrls[0] || installUrls[0];

    return {
      description,
      icon,
      installUrl,
      installUrlRequiresConfig: installUrl ? isTemplateUrl(installUrl) : false,
      pageId,
      repositorySlug,
      title,
      updatedAt: updatedDate ? new Date(updatedDate.replaceAll('.', '-')).toISOString() : undefined,
    };
  }

  private async fetchHigressRegistry(): Promise<AggregatorCandidate[]> {
    const homeHtml = await this.fetchText(`${HIGRESS_MARKET_URL}/`);
    const pageIds = [
      ...new Set([...homeHtml.matchAll(HIGRESS_PAGE_ID_PATTERN)].map((match) => match[1])),
    ].slice(0, getMaxHigressPages());
    const results: AggregatorCandidate[] = [];
    let nextIndex = 0;
    const workerCount = Math.min(INSTALL_VERIFICATION_CONCURRENCY, pageIds.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (true) {
          const currentIndex = nextIndex++;
          const pageId = pageIds[currentIndex];

          if (!pageId) return;

          try {
            const html = await this.fetchText(`${HIGRESS_MARKET_URL}/server/${pageId}`);
            const entry = this.parseHigressEntry(pageId, html);

            if (!entry) continue;

            results.push(
              withMetrics({
                badges: uniq([
                  'remote',
                  entry.installUrlRequiresConfig ? 'config-required' : 'hosted',
                ]),
                description: entry.description,
                homepage: `${HIGRESS_MARKET_URL}/server/${pageId}`,
                icon: entry.icon,
                identifier: `higress/${entry.repositorySlug}`,
                installUrl: entry.installUrl,
                isOfficial: false,
                isRemote: Boolean(entry.installUrl),
                isVerified: false,
                repositoryUrl: `https://github.com/alibaba/higress/tree/main/plugins/wasm-go/mcp-servers/${entry.repositorySlug}`,
                source: AggregatorSource.Higress,
                sourceLink: `${HIGRESS_MARKET_URL}/server/${pageId}`,
                title: entry.title,
                transportTypes: uniq([
                  entry.installUrl?.endsWith('/sse')
                    ? 'sse'
                    : entry.installUrl
                      ? 'streamable-http'
                      : undefined,
                ]),
                updatedAt: entry.updatedAt,
              }),
            );
          } catch {
            // Ignore individual page failures; source-level failure will be surfaced only if home page fails.
          }
        }
      }),
    );

    return results;
  }

  private async fetchOfficialRegistry(): Promise<AggregatorCandidate[]> {
    const candidates: AggregatorCandidate[] = [];
    let cursor: string | undefined;
    let requestCount = 0;

    while (requestCount < getMaxSourceRequests()) {
      const params = new URLSearchParams({
        limit: String(SOURCE_PAGE_SIZE),
      });

      if (cursor) params.set('cursor', cursor);

      const response = await this.fetchJson<OfficialRegistryResponse>(
        `${OFFICIAL_REGISTRY_URL}?${params.toString()}`,
      );

      const items =
        response.servers?.map(({ _meta, server }) => {
          const officialMeta = _meta?.['io.modelcontextprotocol.registry/official'];
          const transportTypes = uniq([
            ...(server?.remotes?.map((remote) => remote.type) || []),
            ...(server?.packages?.map((pkg) => pkg.transport?.type) || []),
          ]);

          return withMetrics({
            badges: uniq([
              officialMeta?.status === 'active' ? 'active' : undefined,
              officialMeta?.isLatest ? 'latest' : undefined,
            ]),
            description: server?.description || '',
            homepage: server?.websiteUrl,
            icon: server?.icons?.[0]?.src,
            identifier: server?.name || server?.title || 'unknown',
            isOfficial: true,
            installUrl: server?.remotes?.find((remote) => !!remote.url)?.url,
            isRemote: (server?.remotes?.length || 0) > 0,
            isVerified: officialMeta?.status === 'active',
            repositoryUrl: server?.repository?.url,
            source: AggregatorSource.Official,
            title: server?.title || server?.name || 'Unnamed MCP Server',
            transportTypes,
            updatedAt: officialMeta?.updatedAt,
          });
        }) || [];

      candidates.push(...items);

      cursor = response.metadata?.nextCursor;
      requestCount += 1;

      if (!cursor) break;
    }

    return candidates;
  }

  private async fetchSmitheryRegistry(): Promise<AggregatorCandidate[]> {
    const candidates: AggregatorCandidate[] = [];

    for (let page = 1; page <= getMaxSourceRequests(); page += 1) {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(SOURCE_PAGE_SIZE),
      });

      const response = await this.fetchJson<SmitheryRegistryResponse>(
        `${SMITHERY_REGISTRY_URL}?${params.toString()}`,
      );

      const items =
        response.servers?.map((server) =>
          withMetrics({
            badges: uniq([
              server.remote ? 'remote' : undefined,
              server.verified ? 'verified' : undefined,
            ]),
            createdAt: server.createdAt,
            description: server.description || '',
            homepage: server.homepage,
            icon: server.iconUrl,
            identifier: server.qualifiedName || server.namespace || 'unknown',
            installCount: server.useCount,
            isOfficial: false,
            isRemote: server.remote ?? false,
            isVerified: server.verified ?? false,
            source: AggregatorSource.Smithery,
            sourceLink: server.homepage,
            title: server.displayName || server.qualifiedName || 'Unnamed MCP Server',
            transportTypes: uniq([server.remote ? 'remote' : 'hosted']),
          }),
        ) || [];

      candidates.push(...items);

      if (items.length < SOURCE_PAGE_SIZE) break;
    }

    return candidates;
  }

  private async fetchGlamaRegistry(): Promise<AggregatorCandidate[]> {
    const candidates: AggregatorCandidate[] = [];
    let after: string | undefined;
    let requestCount = 0;

    while (requestCount < getMaxSourceRequests()) {
      const params = new URLSearchParams({
        first: String(SOURCE_PAGE_SIZE),
      });

      if (after) params.set('after', after);

      const response = await this.fetchJson<GlamaRegistryResponse>(
        `${GLAMA_REGISTRY_URL}?${params.toString()}`,
      );

      const items =
        response.servers?.map((server) => {
          const attributes = server.attributes || [];
          const isRemote = attributes.some(
            (attribute) =>
              attribute.startsWith('hosting:remote') || attribute.startsWith('hosting:hybrid'),
          );

          return withMetrics({
            badges: uniq(attributes),
            description: server.description || '',
            homepage: server.url,
            identifier: [server.namespace, server.slug || server.name].filter(Boolean).join('/'),
            isOfficial: false,
            isRemote,
            isVerified: false,
            repositoryUrl: server.repository?.url,
            source: AggregatorSource.Glama,
            sourceLink: server.url,
            title: server.name || server.slug || 'Unnamed MCP Server',
            toolCount: server.tools?.length,
            transportTypes: uniq(
              attributes.filter((attribute) => attribute.startsWith('hosting:')),
            ),
          });
        }) || [];

      candidates.push(...items);
      requestCount += 1;

      after = response.pageInfo?.endCursor;

      if (!response.pageInfo?.hasNextPage || !after || items.length < SOURCE_PAGE_SIZE) break;
    }

    return candidates;
  }

  private mergeCandidates(candidates: AggregatorCandidate[]) {
    const bucket = new Map<string, AggregatorCandidate[]>();

    for (const candidate of candidates) {
      const key = buildDedupeKey(candidate);
      const items = bucket.get(key) || [];
      items.push(candidate);
      bucket.set(key, items);
    }

    const mergedItems: AggregatorItem[] = [];

    for (const items of bucket.values()) {
      const sources = uniq(items.map((item) => item.source)) as AggregatorSource[];
      const primarySource = getPrimarySource(sources);
      const sortedBySource = [...items].sort(
        (left, right) =>
          SOURCE_PRIORITY.indexOf(left.source) - SOURCE_PRIORITY.indexOf(right.source),
      );
      const preferred =
        sortedBySource.find((item) => item.source === primarySource) || sortedBySource[0];
      const installCandidate = sortedBySource.find((item) => item.installUrl);
      const mergedRemote = items.some((item) => item.isRemote);
      const installability = createInitialInstallability({
        createdAt: preferred.createdAt,
        description: preferred.description,
        homepage: preferred.homepage,
        icon: preferred.icon,
        identifier: preferred.identifier,
        installUrl: installCandidate?.installUrl,
        isRemote: mergedRemote,
        title: preferred.title,
        updatedAt: preferred.updatedAt,
      });

      mergedItems.push({
        badges: uniq(items.flatMap((item) => item.badges)),
        createdAt: sortedBySource
          .map((item) => item.createdAt)
          .filter(Boolean)
          .sort()
          .at(0),
        description: preferred.description,
        homepage: preferred.homepage || sortedBySource.find((item) => item.homepage)?.homepage,
        icon: preferred.icon || sortedBySource.find((item) => item.icon)?.icon,
        id: buildDedupeKey(preferred),
        identifier: preferred.identifier,
        installCount: Math.max(...items.map((item) => item.installCount || 0)) || undefined,
        installability,
        isOfficial: items.some((item) => item.isOfficial),
        isRemote: mergedRemote,
        isVerified: items.some((item) => item.isVerified),
        popularity: Math.max(...items.map((item) => item.popularity || 0)),
        repositoryUrl:
          preferred.repositoryUrl ||
          sortedBySource.find((item) => item.repositoryUrl)?.repositoryUrl,
        score: Math.max(...items.map((item) => item.score)),
        sourceLinks: items
          .filter((item) => item.sourceLink)
          .map((item) => ({ source: item.source, url: item.sourceLink! })),
        sources,
        starCount: Math.max(...items.map((item) => item.starCount || 0)) || undefined,
        title: preferred.title,
        toolCount: Math.max(...items.map((item) => item.toolCount || 0)) || undefined,
        transportTypes: uniq(items.flatMap((item) => item.transportTypes)),
        updatedAt: sortedBySource
          .map((item) => item.updatedAt || item.createdAt)
          .filter(Boolean)
          .sort((left, right) => parseDate(right) - parseDate(left))
          .at(0),
      });
    }

    return mergedItems;
  }

  async collectEntries(): Promise<AggregatorCollection> {
    const [officialResult, higressResult, smitheryResult, glamaResult] = await Promise.allSettled([
      withSourceTimeout(AggregatorSource.Official, this.fetchOfficialRegistry()),
      withSourceTimeout(AggregatorSource.Higress, this.fetchHigressRegistry()),
      withSourceTimeout(AggregatorSource.Smithery, this.fetchSmitheryRegistry()),
      withSourceTimeout(AggregatorSource.Glama, this.fetchGlamaRegistry()),
    ]);

    const candidates: AggregatorCandidate[] = [];
    const warnings: AggregatorCollection['warnings'] = [];

    const collectSettled = (
      source: AggregatorSource,
      result: PromiseSettledResult<AggregatorCandidate[]>,
    ) => {
      if (result.status === 'fulfilled') {
        candidates.push(...result.value);
        return;
      }

      warnings.push({
        message: toErrorMessage(result.reason),
        source,
      });
    };

    collectSettled(AggregatorSource.Official, officialResult);
    collectSettled(AggregatorSource.Higress, higressResult);
    collectSettled(AggregatorSource.Smithery, smitheryResult);
    collectSettled(AggregatorSource.Glama, glamaResult);

    const mergedItems = sortItems(this.mergeCandidates(candidates));
    const sourceCounts = SOURCE_PRIORITY.map((source) => ({
      count: mergedItems.filter((item) => item.sources.includes(source)).length,
      source,
    }));

    return {
      allCount: mergedItems.length,
      fetchedAt: new Date().toISOString(),
      items: mergedItems,
      sourceCounts,
      warnings,
    };
  }

  async buildListResponse(collection: AggregatorCollection, params: AggregatorQueryParams) {
    if (params.installable) {
      const candidates = collection.items.filter((item) => {
        const source = params.source || AGGREGATOR_ALL_SOURCE;

        if (source !== AGGREGATOR_ALL_SOURCE && !item.sources.includes(source)) return false;
        if (params.q && !includesQuery(item, params.q)) return false;
        return isAggregatorInstallable(item.installability);
      });
      const sorted = sortItems(candidates, params.sort);
      const paginated = paginateItems(sorted, params);

      // Verify only the current page to avoid verifying hundreds of items
      const verifiedItems = await this.verifyItems(paginated.items);
      const verifiedPageItems = verifiedItems.filter(({ installability }) =>
        isAggregatorInstallable(installability),
      );

      return {
        ...paginated,
        allCount: collection.allCount,
        fetchedAt: collection.fetchedAt,
        items: verifiedPageItems,
        sourceCounts: collection.sourceCounts,
        stats: {
          installableCount: candidates.length,
          officialCount: verifiedPageItems.filter((item) => item.isOfficial).length,
          remoteCount: verifiedPageItems.filter((item) => item.isRemote).length,
          verifiedCount: verifiedPageItems.filter((item) => item.isVerified).length,
        },
        totalCount: candidates.length,
        totalPages: paginated.totalPages,
        warnings: collection.warnings,
      };
    }

    const response = buildListResponse(collection, params);
    const items = await this.verifyItems(response.items);

    return {
      ...response,
      items,
      stats: {
        ...response.stats,
        installableCount: items.filter(({ installability }) =>
          isAggregatorInstallable(installability),
        ).length,
      },
    };
  }
}

export const aggregatorService = new AggregatorService();
