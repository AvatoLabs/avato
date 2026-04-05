// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getBlobProvider } from './index';

const mockCreatePreSignedDownloadUrl = vi.fn();
const mockGetFileByteArray = vi.fn();

vi.mock('@/server/modules/PrivateBlobS3', () => ({
  getPrivateBlobS3: vi.fn(() => ({
    createPreSignedDownloadUrl: (...args: unknown[]) => mockCreatePreSignedDownloadUrl(...args),
    getFileByteArray: (...args: unknown[]) => mockGetFileByteArray(...args),
  })),
}));

describe('getBlobProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delegate createDownloadUrl to PrivateBlobS3', async () => {
    mockCreatePreSignedDownloadUrl.mockResolvedValue('https://example.com/download');

    const result = await getBlobProvider().createDownloadUrl('files/test.txt', { expiresIn: 120 });

    expect(result).toBe('https://example.com/download');
    expect(mockCreatePreSignedDownloadUrl).toHaveBeenCalledWith('files/test.txt', {
      expiresIn: 120,
    });
  });

  it('should delegate getObjectByteArray to PrivateBlobS3', async () => {
    const content = new Uint8Array([1, 2, 3]);
    mockGetFileByteArray.mockResolvedValue(content);

    const result = await getBlobProvider().getObjectByteArray('files/test.bin');

    expect(result).toEqual(content);
    expect(mockGetFileByteArray).toHaveBeenCalledWith('files/test.bin');
  });
});
