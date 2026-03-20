import { describe, expect, it, vi } from 'vitest';

import { testService } from '~test-utils';

import { SessionService } from './index';

describe('SessionService', () => {
  testService(SessionService, { checkAsync: false });

  describe('hasSessions', () => {
    it('should return true when the session count is greater than zero', async () => {
      const service = new SessionService();

      vi.spyOn(service, 'countSessions').mockResolvedValue(2);

      await expect(service.hasSessions()).resolves.toBe(true);
    });

    it('should return false when the session count is zero', async () => {
      const service = new SessionService();

      vi.spyOn(service, 'countSessions').mockResolvedValue(0);

      await expect(service.hasSessions()).resolves.toBe(false);
    });
  });
});
