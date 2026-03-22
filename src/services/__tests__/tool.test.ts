import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { globalHelpers } from '@/store/global/helpers';

import { toolService } from '../tool';
import OpenAIPlugin from './openai/plugin.json';

// Mocking modules and functions

vi.mock('@/store/global/helpers', () => ({
  globalHelpers: {
    getCurrentLanguage: vi.fn(),
  },
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    market: {
      getPluginList: { query: vi.fn() },
    },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ToolService', () => {
  describe('getDiscoverPluginList', () => {
    it('should query market getPluginList with locale and numeric pagination', async () => {
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('en-US');
      vi.mocked(lambdaClient.market.getPluginList.query).mockResolvedValue({ items: [] });

      await toolService.getDiscoverPluginList({ category: 'tools', page: 2, pageSize: 10 });

      expect(lambdaClient.market.getPluginList.query).toHaveBeenCalledWith({
        category: 'tools',
        locale: 'en-US',
        page: 2,
        pageSize: 10,
      });
    });

    it('should default page and pageSize', async () => {
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('zh-CN');
      vi.mocked(lambdaClient.market.getPluginList.query).mockResolvedValue({ items: [] });

      await toolService.getDiscoverPluginList({});

      expect(lambdaClient.market.getPluginList.query).toHaveBeenCalledWith({
        locale: 'zh-CN',
        page: 1,
        pageSize: 20,
      });
    });
  });

  describe('getToolManifest', () => {
    it('should return manifest', async () => {
      const manifestUrl = 'http://fake-url.com/manifest.json';

      const fakeManifest = {
        $schema: '../node_modules/@lobehub/chat-plugin-sdk/schema.json',
        api: [
          {
            url: 'https://realtime-weather.chat-plugin.lobehub.com/api/v1',
            name: 'fetchCurrentWeather',
            description: '获取当前天气情况',
            parameters: {
              properties: {
                city: {
                  description: '城市名称',
                  type: 'string',
                },
              },
              required: ['city'],
              type: 'object',
            },
          },
        ],
        author: 'LobeHub',
        createAt: '2023-08-12',
        homepage: 'https://github.com/lobehub/chat-plugin-realtime-weather',
        identifier: 'realtime-weather',
        meta: {
          avatar: '🌈',
          tags: ['weather', 'realtime'],
          title: 'Realtime Weather',
          description: 'Get realtime weather information',
        },
        ui: {
          url: 'https://realtime-weather.chat-plugin.lobehub.com/iframe',
          height: 310,
        },
        version: '1',
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({ 'content-type': 'application/json' }),
          ok: true,
          json: () => Promise.resolve(fakeManifest),
        }),
      ) as any;

      const manifest = await toolService.getToolManifest(manifestUrl);

      expect(fetch).toHaveBeenCalledWith(manifestUrl);
      expect(manifest).toEqual(fakeManifest);
    });

    it('should return error on noManifest', async () => {
      try {
        await toolService.getToolManifest();
      } catch (e) {
        expect(e).toEqual(new TypeError('noManifest'));
      }
    });

    it('should return error on manifestInvalid', async () => {
      const fakeManifest = { name: 'TestPlugin', version: '1.0.0' };
      const manifestUrl = 'http://fake-url.com/manifest.json';
      global.fetch = vi.fn(() =>
        Promise.resolve({
          headers: new Headers({ 'content-type': 'application/json' }),
          ok: true,
          json: () => Promise.resolve(fakeManifest),
        }),
      ) as any;

      try {
        await toolService.getToolManifest(manifestUrl);
      } catch (e) {
        expect(e).toEqual(new TypeError('manifestInvalid'));
      }
    });

    it('should return error on fetchError', async () => {
      const manifestUrl = 'http://fake-url.com/manifest.json';
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      try {
        await toolService.getToolManifest(manifestUrl);
      } catch (e) {
        expect(e).toEqual(new TypeError('fetchError'));
      }
      expect(fetch).toHaveBeenCalledWith(manifestUrl);
    });

    it('should return error on manifestInvalid', async () => {
      const fakeManifest = { name: 'TestPlugin', version: '1.0.0' };
      const manifestUrl = 'http://fake-url.com/manifest.json';
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve(fakeManifest),
        }),
      ) as any;

      try {
        await toolService.getToolManifest(manifestUrl);
      } catch (e) {
        expect(e).toEqual(new TypeError('fetchError'));
      }
    });
  });

  it('can parse the OpenAI plugin', async () => {
    const manifest = toolService['convertOpenAIManifestToLobeManifest'](OpenAIPlugin as any);

    expect(manifest).toMatchSnapshot();
  });
});
