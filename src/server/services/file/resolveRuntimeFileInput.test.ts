import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveRuntimeFileInput } from './resolveRuntimeFileInput';

const { mockResolveProviderReadableFileReference } = vi.hoisted(() => ({
  mockResolveProviderReadableFileReference: vi.fn(),
}));

vi.mock('@/server/services/file/resolveProviderReadableFileReference', () => ({
  resolveProviderReadableFileReference: mockResolveProviderReadableFileReference,
}));

describe('resolveRuntimeFileInput', () => {
  const fileService = {
    getFullFileUrl: vi.fn(),
    getKeyFromFullUrl: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    fileService.getFullFileUrl.mockResolvedValue(null);
    fileService.getKeyFromFullUrl.mockResolvedValue(null);
    mockResolveProviderReadableFileReference.mockResolvedValue(null);
  });

  it('returns provider-readable references as-is', async () => {
    mockResolveProviderReadableFileReference.mockResolvedValue({
      fileId: 'file-1',
      key: 'v2/spaces/spc_1/blobs/input.png',
      url: 'https://blob.example.com/input.png',
    });

    const result = await resolveRuntimeFileInput({
      db: {} as any,
      fileService,
      url: '/f/file-1',
      userId: 'user-1',
      via: 'image_generation_input',
    });

    expect(result).toEqual({
      fileId: 'file-1',
      key: 'v2/spaces/spc_1/blobs/input.png',
      url: 'https://blob.example.com/input.png',
    });
    expect(fileService.getKeyFromFullUrl).not.toHaveBeenCalled();
    expect(fileService.getFullFileUrl).not.toHaveBeenCalled();
  });

  it('propagates explicit document-shaped file reference errors without storage fallback', async () => {
    mockResolveProviderReadableFileReference.mockRejectedValue(
      new TRPCError({ code: 'BAD_REQUEST', message: 'DOCUMENT_REFERENCE_NOT_FETCHABLE' }),
    );

    await expect(
      resolveRuntimeFileInput({
        db: {} as any,
        fileService,
        url: '/f/docs_1',
        userId: 'user-1',
        via: 'image_generation_input',
      }),
    ).rejects.toEqual(
      new TRPCError({ code: 'BAD_REQUEST', message: 'DOCUMENT_REFERENCE_NOT_FETCHABLE' }),
    );

    expect(fileService.getKeyFromFullUrl).not.toHaveBeenCalled();
    expect(fileService.getFullFileUrl).not.toHaveBeenCalled();
  });

  it('treats canonical blob keys as first-class internal inputs', async () => {
    fileService.getFullFileUrl.mockResolvedValue('https://blob.example.com/input.png');

    const result = await resolveRuntimeFileInput({
      db: {} as any,
      fileService,
      url: 'v2/spaces/spc_1/blobs/input.png',
      userId: 'user-1',
      via: 'image_generation_input',
    });

    expect(result).toEqual({
      key: 'v2/spaces/spc_1/blobs/input.png',
      url: 'https://blob.example.com/input.png',
    });
    expect(fileService.getKeyFromFullUrl).not.toHaveBeenCalled();
    expect(fileService.getFullFileUrl).toHaveBeenCalledWith('v2/spaces/spc_1/blobs/input.png');
  });

  it('converts extracted internal keys to provider-readable urls', async () => {
    fileService.getKeyFromFullUrl.mockResolvedValue('v2/spaces/spc_1/blobs/input.png');
    fileService.getFullFileUrl.mockResolvedValue('https://blob.example.com/input.png');

    const result = await resolveRuntimeFileInput({
      db: {} as any,
      fileService,
      url: 'https://blob.example.com/v2/spaces/spc_1/blobs/input.png',
      userId: 'user-1',
      via: 'video_generation_input',
    });

    expect(result).toEqual({
      key: 'v2/spaces/spc_1/blobs/input.png',
      url: 'https://blob.example.com/input.png',
    });
    expect(fileService.getKeyFromFullUrl).toHaveBeenCalledWith(
      'https://blob.example.com/v2/spaces/spc_1/blobs/input.png',
    );
    expect(fileService.getFullFileUrl).toHaveBeenCalledWith('v2/spaces/spc_1/blobs/input.png');
  });

  it('fails closed when a resolved internal input cannot become a readable url', async () => {
    await expect(
      resolveRuntimeFileInput({
        db: {} as any,
        fileService,
        url: 'v2/spaces/spc_1/blobs/input.png',
        userId: 'user-1',
        via: 'image_generation_input',
      }),
    ).rejects.toEqual(new TRPCError({ code: 'FORBIDDEN', message: 'RESOURCE_ACCESS_DENIED' }));
  });
});
