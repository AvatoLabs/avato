import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { globalHelpers } from '@/store/global/helpers';

import { discoverService } from '../discover';

vi.mock('@/store/global/helpers', () => ({
  globalHelpers: {
    getCurrentLanguage: vi.fn(),
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: {
    getState: vi.fn(() => ({})),
  },
}));

vi.mock('@/store/user/selectors', () => ({
  userGeneralSettingsSelectors: {
    telemetry: vi.fn(() => false),
  },
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    market: {
      getMcpList: { query: vi.fn() },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(discoverService, 'safeInjectMPToken').mockResolvedValue(undefined);
});

describe('DiscoverService', () => {
  describe('getMcpList', () => {
    it('should disable global notification for MCP list request', async () => {
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('zh-CN');
      vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue({ items: [] } as any);

      await discoverService.getMcpList({ page: 2, pageSize: 10 });

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith(
        {
          locale: 'zh-CN',
          page: 2,
          pageSize: 10,
        },
        { context: { showNotification: false } },
      );
    });
  });

  describe('getMCPPluginList', () => {
    it('should disable global notification for MCP plugin list request', async () => {
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('en-US');
      vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue({ items: [] } as any);

      await discoverService.getMCPPluginList({ identifier: 'test-plugin' } as any);

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith(
        {
          identifier: 'test-plugin',
          locale: 'en-US',
          page: 1,
          pageSize: 21,
        },
        { context: { showNotification: false } },
      );
    });
  });
});
