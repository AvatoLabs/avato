import { promises as fs } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FileService } from '@/server/services/file';
import { calculateThumbnailDimensions } from '@/utils/number';

import { VideoGenerationService } from './video';

const { mockResolveProviderReadableFileReference } = vi.hoisted(() => ({
  mockResolveProviderReadableFileReference: vi.fn(),
}));

vi.mock('debug', () => ({
  default: () => vi.fn(),
}));
vi.mock('@/server/services/file');
vi.mock('@/server/services/file/resolveProviderReadableFileReference', () => ({
  resolveProviderReadableFileReference: mockResolveProviderReadableFileReference,
}));
vi.mock('@/utils/number');
vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('cover-webp')),
    resize: vi.fn().mockReturnThis(),
  })),
}));

describe('VideoGenerationService', () => {
  let service: VideoGenerationService;
  let mockFileService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFileService = {
      createOpaqueUserBlobPath: vi.fn(),
      getFullFileUrl: vi.fn(),
      getKeyFromFullUrl: vi.fn(),
      uploadMedia: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(FileService).mockImplementation(() => mockFileService);
    mockFileService.getKeyFromFullUrl.mockResolvedValue(null);
    mockFileService.getFullFileUrl.mockImplementation(async (url: string) => url);
    mockResolveProviderReadableFileReference.mockReset();
    mockResolveProviderReadableFileReference.mockResolvedValue(null);
    vi.mocked(calculateThumbnailDimensions).mockReturnValue({
      shouldResize: true,
      thumbnailHeight: 240,
      thumbnailWidth: 320,
    });

    service = new VideoGenerationService({} as any, 'user-1');
    vi.spyOn(service as any, 'downloadVideo').mockResolvedValue('/tmp/video.mp4');
    vi.spyOn(service as any, 'getVideoMetadata').mockResolvedValue({
      duration: 12,
      height: 720,
      width: 1280,
    });
    vi.spyOn(service as any, 'generateScreenshot').mockResolvedValue('/tmp/cover.png');
    vi.spyOn(fs, 'readFile')
      .mockResolvedValueOnce(Buffer.from('video-binary') as any)
      .mockResolvedValueOnce(Buffer.from('cover-binary') as any);
    vi.spyOn(fs, 'unlink').mockResolvedValue(undefined as any);
  });

  it('stores generated video assets under opaque space-scoped generation keys', async () => {
    mockFileService.createOpaqueUserBlobPath
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/video.mp4' })
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/cover.webp' })
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/thumb.webp' });

    const result = await service.processVideoForGeneration('https://example.com/video.mp4');

    expect(mockFileService.createOpaqueUserBlobPath.mock.calls).toEqual([
      ['generations/videos', 'mp4'],
      ['generations/videos', 'webp'],
      ['generations/videos', 'webp'],
    ]);
    expect(mockFileService.uploadMedia).toHaveBeenNthCalledWith(
      1,
      'v2/spaces/spc_1/blobs/generations/videos/video.mp4',
      Buffer.from('video-binary'),
    );
    expect(mockFileService.uploadMedia).toHaveBeenNthCalledWith(
      2,
      'v2/spaces/spc_1/blobs/generations/videos/cover.webp',
      Buffer.from('cover-webp'),
    );
    expect(mockFileService.uploadMedia).toHaveBeenNthCalledWith(
      3,
      'v2/spaces/spc_1/blobs/generations/videos/thumb.webp',
      expect.any(Buffer),
    );
    expect(result.videoKey).toBe('v2/spaces/spc_1/blobs/generations/videos/video.mp4');
    expect(result.coverKey).toBe('v2/spaces/spc_1/blobs/generations/videos/cover.webp');
    expect(result.thumbnailKey).toBe('v2/spaces/spc_1/blobs/generations/videos/thumb.webp');
  });

  it('resolves relative stable file proxy URLs before processing generated videos', async () => {
    const readableUrl =
      'https://blob.example.com/v2/spaces/spc_1/blobs/generations/videos/input.mp4';
    mockFileService.getFullFileUrl.mockResolvedValueOnce(readableUrl);
    mockFileService.createOpaqueUserBlobPath
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/video.mp4' })
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/cover.webp' })
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/thumb.webp' });

    const downloadVideoSpy = vi
      .spyOn(service as any, 'downloadVideo')
      .mockResolvedValue('/tmp/video.mp4');

    const result = await service.processVideoForGeneration('/f/file-video-1');

    expect(mockFileService.getFullFileUrl).toHaveBeenCalledWith('/f/file-video-1');
    expect(downloadVideoSpy).toHaveBeenCalledWith(readableUrl);
    expect(mockFileService.createOpaqueUserBlobPath.mock.calls[0]).toEqual([
      'generations/videos',
      'mp4',
    ]);
    expect(result.videoKey).toBe('v2/spaces/spc_1/blobs/generations/videos/video.mp4');
  });

  it('reuses extracted internal keys when resolving full URLs before processing generated videos', async () => {
    const sourceUrl = 'https://blob.example.com/v2/spaces/spc_1/blobs/generations/videos/input.mp4';
    const internalKey = 'v2/spaces/spc_1/blobs/generations/videos/input.mp4';
    const readableUrl =
      'https://blob.example.com/v2/spaces/spc_1/blobs/generations/videos/readable.mp4';

    mockFileService.getKeyFromFullUrl.mockResolvedValueOnce(internalKey);
    mockFileService.getFullFileUrl.mockResolvedValueOnce(readableUrl);
    mockFileService.createOpaqueUserBlobPath
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/video.mp4' })
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/cover.webp' })
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/thumb.webp' });

    const downloadVideoSpy = vi
      .spyOn(service as any, 'downloadVideo')
      .mockResolvedValue('/tmp/video.mp4');

    const result = await service.processVideoForGeneration(sourceUrl);

    expect(mockFileService.getKeyFromFullUrl).toHaveBeenCalledWith(sourceUrl);
    expect(mockFileService.getFullFileUrl).toHaveBeenCalledWith(internalKey);
    expect(downloadVideoSpy).toHaveBeenCalledWith(readableUrl);
    expect(result.videoKey).toBe('v2/spaces/spc_1/blobs/generations/videos/video.mp4');
  });

  it('resolves shared file proxy URLs before processing generated videos', async () => {
    const readableUrl =
      'https://blob.example.com/v2/spaces/spc_1/blobs/generations/videos/input.mp4';
    mockResolveProviderReadableFileReference.mockResolvedValueOnce({
      fileId: 'file-share-1',
      key: 'v2/spaces/spc_1/blobs/generations/videos/input.mp4',
      url: readableUrl,
    });
    mockFileService.createOpaqueUserBlobPath
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/video.mp4' })
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/cover.webp' })
      .mockResolvedValueOnce({ key: 'v2/spaces/spc_1/blobs/generations/videos/thumb.webp' });

    const downloadVideoSpy = vi
      .spyOn(service as any, 'downloadVideo')
      .mockResolvedValue('/tmp/video.mp4');

    const result = await service.processVideoForGeneration(
      '/share/f/share-token-1?password=secret',
    );

    expect(mockResolveProviderReadableFileReference).toHaveBeenCalledWith({
      db: {},
      fileService: mockFileService,
      sourceIp: null,
      url: '/share/f/share-token-1?password=secret',
      userAgent: null,
      userId: 'user-1',
      via: 'video_generation_input',
    });
    expect(mockFileService.getFullFileUrl).not.toHaveBeenCalledWith(
      '/share/f/share-token-1?password=secret',
    );
    expect(downloadVideoSpy).toHaveBeenCalledWith(readableUrl);
    expect(result.videoKey).toBe('v2/spaces/spc_1/blobs/generations/videos/video.mp4');
  });
});
