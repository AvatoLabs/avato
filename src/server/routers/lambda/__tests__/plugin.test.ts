// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServerDB } from '@/database/core/db-adaptor';
import { PluginModel } from '@/database/models/plugin';

import { pluginRouter } from '../plugin';

vi.mock('@/database/core/db-adaptor', () => ({
  getServerDB: vi.fn(),
}));

vi.mock('@/database/models/plugin', () => ({
  PluginModel: vi.fn(),
}));

describe('pluginRouter', () => {
  let pluginModelMock: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getServerDB).mockResolvedValue({} as any);

    pluginModelMock = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    vi.mocked(PluginModel).mockImplementation(() => pluginModelMock as any);
  });

  it('should create a plugin when it does not exist', async () => {
    pluginModelMock.findById.mockResolvedValue(undefined);
    pluginModelMock.create.mockResolvedValue({ identifier: 'demo-plugin' });

    const caller = pluginRouter.createCaller({ userId: 'u1' } as any);
    const result = await caller.createOrInstallPlugin({
      customParams: { manifestUrl: 'https://example.com/manifest.json' },
      identifier: 'demo-plugin',
      manifest: { identifier: 'demo-plugin' },
      settings: { enabled: true },
      type: 'plugin',
    });

    expect(pluginModelMock.create).toHaveBeenCalledWith({
      customParams: { manifestUrl: 'https://example.com/manifest.json' },
      identifier: 'demo-plugin',
      manifest: { identifier: 'demo-plugin' },
      settings: { enabled: true },
      type: 'plugin',
    });
    expect(result).toBe('demo-plugin');
  });

  it('should upsert custom params and preserve existing fields when updating a plugin', async () => {
    pluginModelMock.findById.mockResolvedValue({
      customParams: { manifestUrl: 'https://old.example.com' },
      identifier: 'demo-plugin',
      manifest: { identifier: 'demo-plugin', version: '1.0.0' },
      settings: { enabled: true },
      type: 'plugin',
    });

    const caller = pluginRouter.createCaller({ userId: 'u1' } as any);
    const result = await caller.createOrInstallPlugin({
      customParams: { mcp: { type: 'http', url: 'https://new.example.com/sse' } },
      identifier: 'demo-plugin',
      manifest: { identifier: 'demo-plugin', version: '2.0.0' },
      settings: undefined,
      type: 'customPlugin',
    });

    expect(pluginModelMock.update).toHaveBeenCalledWith('demo-plugin', {
      customParams: { mcp: { type: 'http', url: 'https://new.example.com/sse' } },
      manifest: { identifier: 'demo-plugin', version: '2.0.0' },
      settings: { enabled: true },
      type: 'customPlugin',
    });
    expect(result).toBe('demo-plugin');
  });
});
