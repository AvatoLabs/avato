import { describe, expect, it } from 'vitest';

import { clampFileUrlExpiresIn, resolveFileDownloadPolicy } from './downloadPolicy';

describe('downloadPolicy', () => {
  describe('clampFileUrlExpiresIn', () => {
    it('should fallback to the default expiry for invalid values', () => {
      expect(clampFileUrlExpiresIn()).toBe(3600);
      expect(clampFileUrlExpiresIn(0)).toBe(3600);
      expect(clampFileUrlExpiresIn(-1)).toBe(3600);
      expect(clampFileUrlExpiresIn(Number.NaN)).toBe(3600);
    });

    it('should clamp values to the maximum expiry', () => {
      expect(clampFileUrlExpiresIn(120)).toBe(120);
      expect(clampFileUrlExpiresIn(7200)).toBe(3600);
    });
  });

  describe('resolveFileDownloadPolicy', () => {
    it('should use the session policy for member downloads', () => {
      expect(resolveFileDownloadPolicy('session')).toEqual({
        cacheTtlSeconds: 240,
        signedUrlExpiresIn: 300,
      });
    });

    it('should use the share policy for share-link downloads', () => {
      expect(resolveFileDownloadPolicy('share_query')).toEqual({
        cacheTtlSeconds: 60,
        signedUrlExpiresIn: 120,
      });
      expect(resolveFileDownloadPolicy('share_path')).toEqual({
        cacheTtlSeconds: 60,
        signedUrlExpiresIn: 120,
      });
    });
  });
});
