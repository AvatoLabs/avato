import { describe, expect, it, vi } from 'vitest';

import { resolveRemovableStorageUrls } from './removableStorageUrls';

describe('resolveRemovableStorageUrls', () => {
  it('should preserve hashed blobs when global files are retained', async () => {
    const checkHash = vi.fn();

    const result = await resolveRemovableStorageUrls(
      { checkHash } as any,
      [{ fileHash: 'hash-1', url: 'internal://hashed-file' }],
      false,
    );

    expect(result).toEqual([]);
    expect(checkHash).not.toHaveBeenCalled();
  });

  it('should delete storage for files without a shared hash', async () => {
    const result = await resolveRemovableStorageUrls(
      { checkHash: vi.fn() } as any,
      [{ fileHash: null, url: 'internal://raw-file' }],
      false,
    );

    expect(result).toEqual(['internal://raw-file']);
  });

  it('should only call checkHash once per shared hash', async () => {
    const checkHash = vi.fn().mockResolvedValue({ isExist: false });

    const result = await resolveRemovableStorageUrls(
      { checkHash } as any,
      [
        { fileHash: 'hash-1', url: 'internal://hashed-file-a' },
        { fileHash: 'hash-1', url: 'internal://hashed-file-b' },
      ],
      true,
    );

    expect(result).toEqual(['internal://hashed-file-a', 'internal://hashed-file-b']);
    expect(checkHash).toHaveBeenCalledTimes(1);
    expect(checkHash).toHaveBeenCalledWith('hash-1');
  });
});
