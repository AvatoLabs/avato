// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AggregatorInstallabilityLevel,
  AggregatorInstallabilityReason,
  AggregatorSource,
} from '../../../types/aggregator';
import { AggregatorService } from './index';

const { mockSsrfSafeFetch, mockGetStreamableMcpServerManifest } = vi.hoisted(() => ({
  mockGetStreamableMcpServerManifest: vi.fn(),
  mockSsrfSafeFetch: vi.fn(),
}));

vi.mock('@lobechat/ssrf-safe-fetch', () => ({
  ssrfSafeFetch: mockSsrfSafeFetch,
}));

vi.mock('../mcp', () => ({
  mcpService: {
    getStreamableMcpServerManifest: mockGetStreamableMcpServerManifest,
  },
}));

const createJsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
  });

const createTextResponse = (data: string) =>
  new Response(data, {
    headers: {
      'content-type': 'text/html',
    },
    status: 200,
  });

describe('AggregatorService', () => {
  const service = new AggregatorService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('only exposes installability for official remote entries that pass manifest verification', async () => {
    mockSsrfSafeFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('https://registry.modelcontextprotocol.io/')) {
        return createJsonResponse({
          metadata: {},
          servers: [
            {
              _meta: {
                'io.modelcontextprotocol.registry/official': {
                  isLatest: true,
                  status: 'active',
                  updatedAt: '2026-03-20T00:00:00.000Z',
                },
              },
              server: {
                description: 'Official remote MCP',
                name: 'official-remote',
                remotes: [{ type: 'streamable-http', url: 'https://mcp.example.com' }],
                title: 'Official Remote',
                websiteUrl: 'https://example.com',
              },
            },
          ],
        });
      }

      if (url === 'https://mcp.higress.ai/') {
        return createTextResponse('<html><body>No hosted pages yet.</body></html>');
      }

      if (url.startsWith('https://api.smithery.ai/servers')) {
        return createJsonResponse({ servers: [] });
      }

      if (url.startsWith('https://glama.ai/api/mcp/v1/servers')) {
        return createJsonResponse({ pageInfo: { hasNextPage: false }, servers: [] });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    mockGetStreamableMcpServerManifest.mockResolvedValue({
      api: [],
      identifier: 'aggregator.official-remote',
      meta: { title: 'Official Remote' },
      type: 'mcp',
    });

    const collection = await service.collectEntries();
    expect(collection.items[0].installability.level).toBe(
      AggregatorInstallabilityLevel.Installable,
    );
    expect(collection.items[0].installability.installSchema?.config.url).toBe(
      'https://mcp.example.com',
    );

    const response = await service.buildListResponse(collection, { page: 1, pageSize: 10 });

    expect(response.items[0].installability.level).toBe(AggregatorInstallabilityLevel.Verified);
    expect(response.stats.installableCount).toBe(1);
  });

  it('keeps Higress endpoint templates discoverable until required config is filled', async () => {
    mockSsrfSafeFetch.mockImplementation(async (url: string) => {
      if (url.startsWith('https://registry.modelcontextprotocol.io/')) {
        return createJsonResponse({ metadata: {}, servers: [] });
      }

      if (url === 'https://mcp.higress.ai/') {
        return createTextResponse('<a href="/server/server0006">BraveSearch</a>');
      }

      if (url === 'https://mcp.higress.ai/server/server0006') {
        return createTextResponse(String.raw`
          serverName\\":\\"BraveSearch\\"
          text-sm text-muted-foreground\\",\\"children\\":\\"Search the web\\"
          "src":"https://img.alicdn.com/brave.png"
          2026.03.19\\",\\" \\\",\\"updated\\"
          https://github.com/alibaba/higress/tree/main/plugins/wasm-go/mcp-servers/mcp-bravesearch
          "https://mcp.higress.ai/mcp-bravesearch/{generate_key}"
        `);
      }

      if (url.startsWith('https://api.smithery.ai/servers')) {
        return createJsonResponse({ servers: [] });
      }

      if (url.startsWith('https://glama.ai/api/mcp/v1/servers')) {
        return createJsonResponse({ pageInfo: { hasNextPage: false }, servers: [] });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const collection = await service.collectEntries();

    expect(collection.items).toHaveLength(1);
    expect(collection.items[0].sources).toContain(AggregatorSource.Higress);
    expect(collection.items[0].installability.level).toBe(
      AggregatorInstallabilityLevel.Discoverable,
    );
    expect(collection.items[0].installability.reason).toBe(
      AggregatorInstallabilityReason.ConfigRequired,
    );
    expect(collection.items[0].installability.installSchema?.config.url).toBe(
      'https://mcp.higress.ai/mcp-bravesearch/{generate_key}',
    );

    const response = await service.buildListResponse(collection, { page: 1, pageSize: 10 });

    expect(response.items[0].installability.level).toBe(AggregatorInstallabilityLevel.Discoverable);
    expect(response.items[0].installability.reason).toBe(
      AggregatorInstallabilityReason.ConfigRequired,
    );
    expect(mockGetStreamableMcpServerManifest).not.toHaveBeenCalled();
  });

  it('hides install action again when manifest verification fails', async () => {
    mockGetStreamableMcpServerManifest.mockRejectedValue(new Error('Connection failed'));

    const response = await service.buildListResponse(
      {
        allCount: 1,
        fetchedAt: new Date('2026-03-20T00:00:00.000Z').toISOString(),
        items: [
          {
            badges: ['active'],
            description: 'Remote MCP',
            id: 'remote-mcp',
            identifier: 'official-remote',
            installability: {
              installSchema: {
                author: 'MCP Aggregator',
                config: {
                  type: 'http',
                  url: 'https://mcp.example.com',
                },
                description: 'Remote MCP',
                identifier: 'aggregator.official-remote',
                name: 'Official Remote',
                version: 'latest',
              },
              level: AggregatorInstallabilityLevel.Installable,
            },
            isOfficial: true,
            isRemote: true,
            isVerified: true,
            popularity: 100,
            score: 100,
            sourceLinks: [{ source: AggregatorSource.Official, url: 'https://example.com' }],
            sources: [AggregatorSource.Official],
            title: 'Official Remote',
            transportTypes: ['streamable-http'],
          },
        ],
        sourceCounts: [{ count: 1, source: AggregatorSource.Official }],
        warnings: [],
      },
      { page: 1, pageSize: 10 },
    );

    expect(response.items[0].installability).toEqual({
      installSchema: {
        author: 'MCP Aggregator',
        config: {
          type: 'http',
          url: 'https://mcp.example.com',
        },
        description: 'Remote MCP',
        identifier: 'aggregator.official-remote',
        name: 'Official Remote',
        version: 'latest',
      },
      level: AggregatorInstallabilityLevel.Discoverable,
      reason: AggregatorInstallabilityReason.VerificationFailed,
    });
    expect(response.stats.installableCount).toBe(0);
  });

  it('only returns verified entries when installable filter is enabled', async () => {
    mockGetStreamableMcpServerManifest.mockImplementation(
      async (_identifier: string, url: string) => {
        if (url === 'https://mcp.example.com/good') {
          return {
            api: [],
            identifier: 'aggregator.good',
            meta: { title: 'Good Remote' },
            type: 'mcp',
          };
        }

        throw new Error('Connection failed');
      },
    );

    const response = await service.buildListResponse(
      {
        allCount: 3,
        fetchedAt: new Date('2026-03-20T00:00:00.000Z').toISOString(),
        items: [
          {
            badges: ['active'],
            description: 'Good remote MCP',
            id: 'good-remote',
            identifier: 'good-remote',
            installability: {
              installSchema: {
                author: 'MCP Aggregator',
                config: {
                  type: 'http',
                  url: 'https://mcp.example.com/good',
                },
                description: 'Good remote MCP',
                identifier: 'aggregator.good',
                name: 'Good Remote',
                version: 'latest',
              },
              level: AggregatorInstallabilityLevel.Installable,
            },
            isOfficial: true,
            isRemote: true,
            isVerified: true,
            popularity: 100,
            score: 100,
            sourceLinks: [{ source: AggregatorSource.Official, url: 'https://example.com/good' }],
            sources: [AggregatorSource.Official],
            title: 'Good Remote',
            transportTypes: ['streamable-http'],
          },
          {
            badges: ['active'],
            description: 'Bad remote MCP',
            id: 'bad-remote',
            identifier: 'bad-remote',
            installability: {
              installSchema: {
                author: 'MCP Aggregator',
                config: {
                  type: 'http',
                  url: 'https://mcp.example.com/bad',
                },
                description: 'Bad remote MCP',
                identifier: 'aggregator.bad',
                name: 'Bad Remote',
                version: 'latest',
              },
              level: AggregatorInstallabilityLevel.Installable,
            },
            isOfficial: false,
            isRemote: true,
            isVerified: false,
            popularity: 90,
            score: 90,
            sourceLinks: [{ source: AggregatorSource.Glama, url: 'https://example.com/bad' }],
            sources: [AggregatorSource.Glama],
            title: 'Bad Remote',
            transportTypes: ['streamable-http'],
          },
          {
            badges: ['remote', 'config-required'],
            description: 'Template-based remote MCP',
            id: 'template-remote',
            identifier: 'template-remote',
            installability: {
              installSchema: {
                author: 'MCP Aggregator',
                config: {
                  type: 'http',
                  url: 'https://mcp.higress.ai/mcp-example/{generate_key}',
                },
                description: 'Template-based remote MCP',
                identifier: 'aggregator.template',
                name: 'Template Remote',
                version: 'latest',
              },
              level: AggregatorInstallabilityLevel.Discoverable,
              reason: AggregatorInstallabilityReason.ConfigRequired,
            },
            isOfficial: false,
            isRemote: true,
            isVerified: false,
            popularity: 80,
            score: 80,
            sourceLinks: [
              { source: AggregatorSource.Higress, url: 'https://mcp.higress.ai/server/server0006' },
            ],
            sources: [AggregatorSource.Higress],
            title: 'Template Remote',
            transportTypes: ['streamable-http'],
          },
        ],
        sourceCounts: [
          { count: 1, source: AggregatorSource.Official },
          { count: 1, source: AggregatorSource.Higress },
          { count: 0, source: AggregatorSource.Smithery },
          { count: 1, source: AggregatorSource.Glama },
        ],
        warnings: [],
      },
      { installable: true, page: 1, pageSize: 10 },
    );

    expect(response.totalCount).toBe(1);
    expect(response.items).toHaveLength(1);
    expect(response.items[0].id).toBe('good-remote');
    expect(response.items[0].installability.level).toBe(AggregatorInstallabilityLevel.Verified);
    expect(response.stats.installableCount).toBe(1);
  });
});
