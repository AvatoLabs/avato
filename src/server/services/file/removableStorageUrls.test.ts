import { describe, expect, it, vi } from 'vitest';

import { resolveRemovableStorageUrls } from './removableStorageUrls';

describe('resolveRemovableStorageUrls', () => {
  it('should preserve hashed blobs when global files are retained', async () => {
    const checkHash = vi.fn();
    const hasFilesForBlob = vi.fn();

    const result = await resolveRemovableStorageUrls(
      { checkHash, hasFilesForBlob } as any,
      [{ fileHash: 'hash-1', url: 'internal://hashed-file' }],
      false,
    );

    expect(result).toEqual([]);
    expect(checkHash).not.toHaveBeenCalled();
    expect(hasFilesForBlob).not.toHaveBeenCalled();
  });

  it('should delete storage for files without a shared hash', async () => {
    const result = await resolveRemovableStorageUrls(
      { checkHash: vi.fn(), hasFilesForBlob: vi.fn() } as any,
      [{ fileHash: null, url: 'internal://raw-file' }],
      false,
    );

    expect(result).toEqual(['internal://raw-file']);
  });

  it('should only call checkHash once per shared hash', async () => {
    const checkHash = vi.fn().mockResolvedValue({ isExist: false });
    const hasFilesForBlob = vi.fn();

    const result = await resolveRemovableStorageUrls(
      { checkHash, hasFilesForBlob } as any,
      [
        { fileHash: 'hash-1', url: 'internal://hashed-file-a' },
        { fileHash: 'hash-1', url: 'internal://hashed-file-b' },
      ],
      true,
    );

    expect(result).toEqual(['internal://hashed-file-a', 'internal://hashed-file-b']);
    expect(checkHash).toHaveBeenCalledTimes(1);
    expect(checkHash).toHaveBeenCalledWith('hash-1');
    expect(hasFilesForBlob).not.toHaveBeenCalled();
  });

  it('should preserve storage while another file still references the same blob', async () => {
    const checkHash = vi.fn();
    const hasFilesForBlob = vi.fn().mockResolvedValue(true);

    const result = await resolveRemovableStorageUrls(
      { checkHash, hasFilesForBlob } as any,
      [{ blobId: 'blob-1', fileHash: null, url: 'v2/spaces/spc_1/blobs/blob-1' }],
      false,
    );

    expect(result).toEqual([]);
    expect(hasFilesForBlob).toHaveBeenCalledTimes(1);
    expect(hasFilesForBlob).toHaveBeenCalledWith('blob-1');
    expect(checkHash).not.toHaveBeenCalled();
  });

  it('should delete storage once the last blob reference is gone', async () => {
    const checkHash = vi.fn();
    const hasFilesForBlob = vi.fn().mockResolvedValue(false);

    const result = await resolveRemovableStorageUrls(
      { checkHash, hasFilesForBlob } as any,
      [
        { blobId: 'blob-1', fileHash: null, url: 'v2/spaces/spc_1/blobs/blob-1' },
        { blobId: 'blob-1', fileHash: null, url: 'v2/spaces/spc_1/blobs/blob-1' },
      ],
      false,
    );

    expect(result).toEqual(['v2/spaces/spc_1/blobs/blob-1']);
    expect(hasFilesForBlob).toHaveBeenCalledTimes(1);
    expect(hasFilesForBlob).toHaveBeenCalledWith('blob-1');
    expect(checkHash).not.toHaveBeenCalled();
  });
});
