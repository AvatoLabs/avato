import { sha256 } from 'js-sha256';
import mime from 'mime';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileService } from '@/server/services/file';
import { calculateThumbnailDimensions } from '@/utils/number';
import { inferFileExtensionFromImageUrl } from '@/utils/url';

import { fetchImageFromUrl, GenerationService } from './index';

const { mockResolveProviderReadableFileReference } = vi.hoisted(() => ({
  mockResolveProviderReadableFileReference: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('debug', () => ({
  default: () => vi.fn(),
}));
vi.mock('js-sha256');
vi.mock('mime');
vi.mock('sharp');
vi.mock('@/server/services/file');
vi.mock('@/server/services/file/resolveProviderReadableFileReference', () => ({
  resolveProviderReadableFileReference: mockResolveProviderReadableFileReference,
}));
vi.mock('@/utils/number');
vi.mock('@/utils/url');

describe('GenerationService', () => {
  let service: GenerationService;
  const mockDb = {} as any;
  const mockUserId = 'test-user';
  let mockFileService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup common mocks used across all tests
    mockFileService = {
      createOpaqueUserBlobPath: vi.fn(),
      getFullFileUrl: vi.fn(),
      getKeyFromFullUrl: vi.fn(),
      uploadMedia: vi.fn(),
    };
    vi.mocked(FileService).mockImplementation(() => mockFileService);
    mockFileService.getKeyFromFullUrl.mockResolvedValue(null);
    mockFileService.getFullFileUrl.mockImplementation(async (url: string) => url);
    mockResolveProviderReadableFileReference.mockReset();
    mockResolveProviderReadableFileReference.mockResolvedValue(null);

    // Setup mime.getExtension with consistent behavior
    vi.mocked(mime.getExtension).mockImplementation((mimeType) => {
      const extensions = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/unknown': null,
      };
      return extensions[mimeType as keyof typeof extensions] || 'png';
    });

    // Setup inferFileExtensionFromImageUrl with consistent behavior
    vi.mocked(inferFileExtensionFromImageUrl).mockImplementation((url) => {
      if (url.includes('.jpg')) return 'jpg';
      if (url.includes('.gif')) return 'gif';
      if (url.includes('image') && !url.includes('.')) return ''; // For error testing
      return 'png';
    });

    service = new GenerationService(mockDb, mockUserId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchImageFromUrl', () => {
    // Note: Using global beforeEach/afterEach from parent describe for consistency

    describe('base64 data URI', () => {
      it('should extract buffer and MIME type from base64 data URI', async () => {
        const base64Data =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
        const dataUri = `data:image/png;base64,${base64Data}`;

        const result = await fetchImageFromUrl(dataUri);

        expect(result.mimeType).toBe('image/png');
        expect(result.buffer).toBeInstanceOf(Buffer);
        expect(result.buffer.length).toBeGreaterThan(0);
        expect(Buffer.from(base64Data, 'base64').equals(result.buffer)).toBe(true);
      });

      it('should handle different MIME types in base64 data URI', async () => {
        const base64Data = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        const dataUri = `data:image/gif;base64,${base64Data}`;

        const result = await fetchImageFromUrl(dataUri);

        expect(result.mimeType).toBe('image/gif');
        expect(result.buffer).toBeInstanceOf(Buffer);
      });

      it('should handle base64 data URI with additional parameters', async () => {
        const base64Data =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
        const dataUri = `data:image/png;charset=utf-8;base64,${base64Data}`;

        const result = await fetchImageFromUrl(dataUri);

        // parseDataUri now supports additional parameters before ;base64,
        expect(result.mimeType).toBe('image/png;charset=utf-8');
        expect(result.buffer).toBeInstanceOf(Buffer);
        expect(Buffer.from(base64Data, 'base64').equals(result.buffer)).toBe(true);
      });
    });

    describe('HTTP URL', () => {
      it('should fetch image from HTTP URL successfully', async () => {
        const mockBuffer = Buffer.from('mock image data');
        const mockArrayBuffer = mockBuffer.buffer.slice(
          mockBuffer.byteOffset,
          mockBuffer.byteOffset + mockBuffer.byteLength,
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn().mockReturnValue('image/jpeg'),
          },
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        });

        const result = await fetchImageFromUrl('https://example.com/image.jpg');

        expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.jpg', {
          headers: undefined,
        });
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.buffer).toBeInstanceOf(Buffer);
        expect(result.buffer.equals(mockBuffer)).toBe(true);
      });

      it('should fetch image with custom fetchHeaders', async () => {
        const mockBuffer = Buffer.from('mock image data');
        const mockArrayBuffer = mockBuffer.buffer.slice(
          mockBuffer.byteOffset,
          mockBuffer.byteOffset + mockBuffer.byteLength,
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn().mockReturnValue('image/jpeg'),
          },
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        });

        const customHeaders = {
          'Authorization': 'Bearer token123',
          'X-API-Key': 'api-key-456',
        };

        const result = await fetchImageFromUrl('https://example.com/image.jpg', customHeaders);

        expect(mockFetch).toHaveBeenCalledWith('https://example.com/image.jpg', {
          headers: customHeaders,
        });
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.buffer).toBeInstanceOf(Buffer);
        expect(result.buffer.equals(mockBuffer)).toBe(true);
      });

      it('should handle missing content-type header', async () => {
        const mockBuffer = Buffer.from('mock image data');
        const mockArrayBuffer = mockBuffer.buffer.slice(
          mockBuffer.byteOffset,
          mockBuffer.byteOffset + mockBuffer.byteLength,
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn().mockReturnValue(null), // No content-type header
          },
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        });

        const result = await fetchImageFromUrl('https://example.com/image.jpg');

        expect(result.mimeType).toBe('application/octet-stream');
        expect(result.buffer).toBeInstanceOf(Buffer);
      });

      it('should throw error when fetch fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        await expect(fetchImageFromUrl('https://example.com/nonexistent.jpg')).rejects.toThrow(
          'Failed to fetch image from https://example.com/nonexistent.jpg: 404 Not Found',
        );

        expect(mockFetch).toHaveBeenCalledWith('https://example.com/nonexistent.jpg', {
          headers: undefined,
        });
      });

      it('should throw error when network request fails', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(fetchImageFromUrl('https://example.com/image.jpg')).rejects.toThrow(
          'Network error',
        );
      });
    });

    describe('edge cases', () => {
      it('should handle base64 data URI correctly', async () => {
        const base64Data =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
        const dataUri = `data:image/png;base64,${base64Data}`;

        const result = await fetchImageFromUrl(dataUri);

        expect(result.mimeType).toBe('image/png');
        expect(result.buffer).toBeInstanceOf(Buffer);
      });

      it('should throw error for invalid data URI format', async () => {
        const invalidDataUri = 'data:image/png:invalid-format';

        await expect(fetchImageFromUrl(invalidDataUri)).rejects.toThrow(
          'Invalid data URI format: data:image/png:invalid-format',
        );
      });

      it('should throw error for malformed data URI without base64', async () => {
        const malformedDataUri = 'data:image/png;charset=utf-8,not-base64-data';

        await expect(fetchImageFromUrl(malformedDataUri)).rejects.toThrow(
          'Invalid data URI format: data:image/png;charset=utf-8,not-base64-data',
        );
      });

      it('should handle different URL schemes', async () => {
        const mockBuffer = Buffer.from('mock image data');
        const mockArrayBuffer = mockBuffer.buffer.slice(
          mockBuffer.byteOffset,
          mockBuffer.byteOffset + mockBuffer.byteLength,
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn().mockReturnValue('image/png'),
          },
          arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        });

        const result = await fetchImageFromUrl('http://example.com/image.png');

        expect(result.mimeType).toBe('image/png');
        expect(result.buffer).toBeInstanceOf(Buffer);
      });
    });

    describe('return type validation', () => {
      it('should return object with correct structure', async () => {
        const base64Data =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
        const dataUri = `data:image/png;base64,${base64Data}`;

        const result = await fetchImageFromUrl(dataUri);

        expect(result).toHaveProperty('buffer');
        expect(result).toHaveProperty('mimeType');
        expect(typeof result.mimeType).toBe('string');
        expect(result.buffer).toBeInstanceOf(Buffer);
      });
    });
  });

  describe('transformImageForGeneration', () => {
    const mockOriginalBuffer = Buffer.from('original image data');
    const mockThumbnailBuffer = Buffer.from('thumbnail image data');

    beforeEach(() => {
      // Reset and configure sha256 with stable implementation
      vi.mocked(sha256)
        .mockReset()
        .mockImplementation(
          (buffer: any) => `hash-${buffer.length}-${buffer.slice(0, 4).toString('hex')}`,
        );
    });

    it('should transform base64 image successfully', async () => {
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'png', width: 800, height: 600 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 512,
        thumbnailHeight: 384,
      });

      const result = await service.transformImageForGeneration(dataUri);

      // Verify image properties
      expect(result.image.width).toBe(800);
      expect(result.image.height).toBe(600);
      expect(result.image.extension).toBe('png');
      expect(result.image.sha256).toMatch(/^hash-\d+-/); // Matches our stable hash format

      // Verify thumbnail properties
      expect(result.thumbnailImage.width).toBe(512);
      expect(result.thumbnailImage.height).toBe(384);
      expect(result.thumbnailImage.sha256).toMatch(/^hash-\d+-/);

      // Verify resize was called with correct dimensions
      expect(mockSharp.resize).toHaveBeenCalledWith(512, 384);
      expect(mockSharp.resize).toHaveBeenCalledTimes(1);

      // Verify sha256 was called twice (for original and thumbnail)
      expect(vi.mocked(sha256)).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP URL successfully', async () => {
      const url = 'https://example.com/image.jpg';

      // Mock fetch for HTTP URL
      const mockArrayBuffer = mockOriginalBuffer.buffer.slice(
        mockOriginalBuffer.byteOffset,
        mockOriginalBuffer.byteOffset + mockOriginalBuffer.byteLength,
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      });

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'jpeg', width: 1024, height: 768 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 512,
        thumbnailHeight: 384,
      });

      const result = await service.transformImageForGeneration(url);

      expect(result.image.width).toBe(1024);
      expect(result.image.height).toBe(768);
      expect(result.image.extension).toBe('jpg'); // URL is image.jpg, so extension should be jpg
      expect(result.thumbnailImage.width).toBe(512);
      expect(result.thumbnailImage.height).toBe(384);
    });

    it('should resolve relative stable file proxy URLs before transforming images', async () => {
      const url = '/f/file-1';
      const readableUrl = 'https://blob.example.com/v2/spaces/spc_personal/blobs/source.png';

      const mockArrayBuffer = mockOriginalBuffer.buffer.slice(
        mockOriginalBuffer.byteOffset,
        mockOriginalBuffer.byteOffset + mockOriginalBuffer.byteLength,
      );
      mockFileService.getFullFileUrl.mockResolvedValueOnce(readableUrl);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      });

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'png', width: 1024, height: 768 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 512,
        thumbnailHeight: 384,
      });

      const result = await service.transformImageForGeneration(url);

      expect(mockFileService.getFullFileUrl).toHaveBeenCalledWith(url);
      expect(mockFetch).toHaveBeenCalledWith(readableUrl, { headers: undefined });
      expect(result.image.extension).toBe('png');
      expect(result.thumbnailImage.width).toBe(512);
      expect(result.thumbnailImage.height).toBe(384);
    });

    it('should handle images that do not need resizing', async () => {
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'png', width: 256, height: 256 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: false,
        thumbnailWidth: 256,
        thumbnailHeight: 256,
      });

      const result = await service.transformImageForGeneration(dataUri);

      // When no resizing is needed but format is not webp, thumbnail is still processed for format conversion
      const expectedBuffer = Buffer.from(base64Data, 'base64');
      expect(result.image.buffer).toEqual(expectedBuffer);
      // Thumbnail buffer will be different because it's converted to WebP even without resizing
      expect(result.thumbnailImage.buffer).toEqual(mockThumbnailBuffer);
      // Resize is called with original dimensions for format conversion
      expect(mockSharp.resize).toHaveBeenCalledWith(256, 256);
    });

    it('should throw error for invalid image format', async () => {
      const dataUri = 'data:image/png;base64,invalid-data';

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'png', width: null, height: null }),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);

      await expect(service.transformImageForGeneration(dataUri)).rejects.toThrow(
        'Invalid image format: png, url: data:image/png;base64,invalid-data',
      );
    });

    it('should throw error when unable to determine extension from MIME type', async () => {
      const dataUri = 'data:image/unknown;base64,some-data';
      vi.mocked(mime.getExtension).mockReturnValue(null);

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'unknown', width: 100, height: 100 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: false,
        thumbnailWidth: 100,
        thumbnailHeight: 100,
      });

      await expect(service.transformImageForGeneration(dataUri)).rejects.toThrow(
        'Unable to determine file extension for MIME type: image/unknown',
      );
    });

    it('should throw error when unable to determine extension from URL', async () => {
      const url = 'https://example.com/image';
      vi.mocked(inferFileExtensionFromImageUrl).mockReturnValue('');

      // Mock fetch for HTTP URL - return a MIME type that can't be resolved to extension
      const mockArrayBuffer = mockOriginalBuffer.buffer.slice(
        mockOriginalBuffer.byteOffset,
        mockOriginalBuffer.byteOffset + mockOriginalBuffer.byteLength,
      );
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/octet-stream'), // Changed to unresolvable MIME type
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      });

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'jpeg', width: 100, height: 100 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: false,
        thumbnailWidth: 100,
        thumbnailHeight: 100,
      });

      await expect(service.transformImageForGeneration(url)).rejects.toThrow(
        'Unable to determine file extension from URL: https://example.com/image',
      );
    });

    it('should handle sharp processing error', async () => {
      const dataUri = 'data:image/png;base64,invalid-data';

      const mockSharp = {
        metadata: vi.fn().mockRejectedValue(new Error('Invalid image data')),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);

      await expect(service.transformImageForGeneration(dataUri)).rejects.toThrow(
        'Invalid image data',
      );
    });

    it('should handle sharp resize error', async () => {
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'png', width: 800, height: 600 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockRejectedValue(new Error('Sharp processing failed')),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 512,
        thumbnailHeight: 384,
      });

      await expect(service.transformImageForGeneration(dataUri)).rejects.toThrow(
        'Sharp processing failed',
      );
    });

    it('should validate resize dimensions are called correctly', async () => {
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'png', width: 1024, height: 768 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 400,
        thumbnailHeight: 300,
      });

      await service.transformImageForGeneration(dataUri);

      // Verify resize was called with exact calculated dimensions
      expect(mockSharp.resize).toHaveBeenCalledWith(400, 300);
      expect(mockSharp.resize).toHaveBeenCalledTimes(1);

      // Verify calculateThumbnailDimensions was called with original dimensions
      expect(calculateThumbnailDimensions).toHaveBeenCalledWith(1024, 768);
    });

    it('should validate file naming pattern includes correct dimensions', async () => {
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'png', width: 1920, height: 1080 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 512,
        thumbnailHeight: 288,
      });

      const result = await service.transformImageForGeneration(dataUri);

      // Verify original image dimensions are preserved
      expect(result.image.width).toBe(1920);
      expect(result.image.height).toBe(1080);

      // Verify thumbnail dimensions match calculation
      expect(result.thumbnailImage.width).toBe(512);
      expect(result.thumbnailImage.height).toBe(288);

      // Verify proper extensions - image keeps original, thumbnail becomes webp
      expect(result.image.extension).toBe('png');
      expect(result.thumbnailImage.extension).toBe('webp');
    });

    it('should verify sha256 is called exactly twice for transformations', async () => {
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
      const dataUri = `data:image/png;base64,${base64Data}`;

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ format: 'png', width: 800, height: 600 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockThumbnailBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 512,
        thumbnailHeight: 384,
      });

      await service.transformImageForGeneration(dataUri);

      // Should call sha256 exactly twice: once for original, once for thumbnail
      expect(vi.mocked(sha256)).toHaveBeenCalledTimes(2);

      // Verify it's called with Buffer instances
      const calls = vi.mocked(sha256).mock.calls;
      expect(calls[0][0]).toBeInstanceOf(Buffer); // Original image buffer
      expect(calls[1][0]).toBeInstanceOf(Buffer); // Thumbnail buffer
    });
  });

  describe('uploadImageForGeneration', () => {
    const mockImage = {
      buffer: Buffer.from('image data'),
      extension: 'png',
      hash: 'image-hash',
      height: 800,
      mime: 'image/png',
      size: 1000,
      width: 600,
    };

    const mockThumbnail = {
      buffer: Buffer.from('thumbnail data'),
      extension: 'png',
      hash: 'thumbnail-hash',
      height: 400,
      mime: 'image/png',
      size: 500,
      width: 300,
    };

    it('should upload both images when buffers are different', async () => {
      mockFileService.createOpaqueUserBlobPath
        .mockResolvedValueOnce({ key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png' })
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/thumb.png',
        });
      mockFileService.uploadMedia
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
        })
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/thumb.png',
        });

      const result = await service.uploadImageForGeneration(mockImage, mockThumbnail);

      expect(mockFileService.uploadMedia).toHaveBeenCalledTimes(2);

      expect(mockFileService.createOpaqueUserBlobPath).toHaveBeenNthCalledWith(
        1,
        'generations/images',
        'png',
      );
      expect(mockFileService.createOpaqueUserBlobPath).toHaveBeenNthCalledWith(
        2,
        'generations/images',
        'png',
      );
      expect(mockFileService.uploadMedia).toHaveBeenNthCalledWith(
        1,
        'v2/spaces/spc_personal/blobs/generations/images/raw.png',
        mockImage.buffer,
      );
      expect(mockFileService.uploadMedia).toHaveBeenNthCalledWith(
        2,
        'v2/spaces/spc_personal/blobs/generations/images/thumb.png',
        mockThumbnail.buffer,
      );

      expect(result).toEqual({
        imageUrl: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
        thumbnailImageUrl: 'v2/spaces/spc_personal/blobs/generations/images/thumb.png',
      });
    });

    it('should upload single image when buffers are identical', async () => {
      const identicalBuffer = Buffer.from('same data');
      const imageWithSameBuffer = { ...mockImage, buffer: identicalBuffer };
      const thumbnailWithSameBuffer = { ...mockThumbnail, buffer: identicalBuffer };

      mockFileService.createOpaqueUserBlobPath.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
      });
      mockFileService.uploadMedia.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
      });

      const result = await service.uploadImageForGeneration(
        imageWithSameBuffer,
        thumbnailWithSameBuffer,
      );

      expect(mockFileService.uploadMedia).toHaveBeenCalledTimes(1);
      expect(mockFileService.createOpaqueUserBlobPath).toHaveBeenCalledWith(
        'generations/images',
        'png',
      );
      expect(mockFileService.uploadMedia).toHaveBeenCalledWith(
        'v2/spaces/spc_personal/blobs/generations/images/raw.png',
        identicalBuffer,
      );
      expect(result).toEqual({
        imageUrl: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
        thumbnailImageUrl: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
      });
    });

    it('should handle partial upload failure in concurrent uploads', async () => {
      mockFileService.createOpaqueUserBlobPath
        .mockResolvedValueOnce({ key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png' })
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/thumb.png',
        });
      mockFileService.uploadMedia
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
        })
        .mockRejectedValueOnce(new Error('Thumbnail upload failed'));

      await expect(service.uploadImageForGeneration(mockImage, mockThumbnail)).rejects.toThrow(
        'Thumbnail upload failed',
      );

      // Verify both uploads were attempted
      expect(mockFileService.uploadMedia).toHaveBeenCalledTimes(2);
    });

    it('should handle complete upload failure', async () => {
      mockFileService.createOpaqueUserBlobPath
        .mockResolvedValueOnce({ key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png' })
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/thumb.png',
        });
      mockFileService.uploadMedia
        .mockRejectedValueOnce(new Error('Image upload failed'))
        .mockRejectedValueOnce(new Error('Thumbnail upload failed'));

      await expect(service.uploadImageForGeneration(mockImage, mockThumbnail)).rejects.toThrow(
        'Image upload failed',
      );

      // Should fail fast on first rejection
      expect(mockFileService.uploadMedia).toHaveBeenCalledTimes(2);
    });

    it('should handle single image upload failure', async () => {
      const identicalBuffer = Buffer.from('same data');
      const imageWithSameBuffer = { ...mockImage, buffer: identicalBuffer };
      const thumbnailWithSameBuffer = { ...mockThumbnail, buffer: identicalBuffer };

      mockFileService.createOpaqueUserBlobPath.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
      });
      mockFileService.uploadMedia.mockRejectedValueOnce(new Error('Upload service unavailable'));

      await expect(
        service.uploadImageForGeneration(imageWithSameBuffer, thumbnailWithSameBuffer),
      ).rejects.toThrow('Upload service unavailable');

      expect(mockFileService.uploadMedia).toHaveBeenCalledTimes(1);
    });

    it('should allocate opaque generation image paths in the caller space', async () => {
      mockFileService.createOpaqueUserBlobPath
        .mockResolvedValueOnce({ key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png' })
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/thumb.png',
        });
      mockFileService.uploadMedia
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/raw.png',
        })
        .mockResolvedValueOnce({
          key: 'v2/spaces/spc_personal/blobs/generations/images/thumb.png',
        });

      await service.uploadImageForGeneration(mockImage, mockThumbnail);

      expect(mockFileService.createOpaqueUserBlobPath.mock.calls).toEqual([
        ['generations/images', 'png'],
        ['generations/images', 'png'],
      ]);
    });
  });

  describe('createCoverFromUrl', () => {
    const mockCoverBuffer = Buffer.from('cover image data');

    // Note: Using global mock configuration from parent describe

    it('should create cover from base64 data URI', async () => {
      const base64Data =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWqGfKwAAAABJRU5ErkJggg==';
      const dataUri = `data:image/jpeg;base64,${base64Data}`;

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ width: 512, height: 384 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockCoverBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 256,
        thumbnailHeight: 192,
      });

      mockFileService.createOpaqueUserBlobPath.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });
      mockFileService.uploadMedia.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });

      const result = await service.createCoverFromUrl(dataUri);

      expect(mockFileService.createOpaqueUserBlobPath).toHaveBeenCalledWith(
        'generations/covers',
        'webp',
      );
      expect(mockSharp.resize).toHaveBeenCalledWith(256, 192);
      expect(mockFileService.uploadMedia).toHaveBeenCalledWith(
        'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
        mockCoverBuffer,
      );
      expect(result).toBe('v2/spaces/spc_personal/blobs/generations/covers/cover.webp');
    });

    it('should create cover from HTTP URL', async () => {
      const url = 'https://example.com/image.jpg';
      const internalKey = 'v2/spaces/spc_personal/blobs/source.jpg';
      const readableUrl = 'https://blob.example.com/v2/spaces/spc_personal/blobs/source.jpg';

      // Mock fetch for HTTP URL
      const mockBuffer = Buffer.from('original image data');
      const mockArrayBuffer = mockBuffer.buffer.slice(
        mockBuffer.byteOffset,
        mockBuffer.byteOffset + mockBuffer.byteLength,
      );
      mockFileService.getKeyFromFullUrl.mockResolvedValueOnce(internalKey);
      mockFileService.getFullFileUrl.mockResolvedValueOnce(readableUrl);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/jpeg'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      });

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockCoverBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 256,
        thumbnailHeight: 192,
      });

      mockFileService.createOpaqueUserBlobPath.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });
      mockFileService.uploadMedia.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });

      const result = await service.createCoverFromUrl(url);

      expect(mockFileService.getKeyFromFullUrl).toHaveBeenCalledWith(url);
      expect(mockFileService.getFullFileUrl).toHaveBeenCalledWith(internalKey);
      expect(mockFetch).toHaveBeenCalledWith(readableUrl, { headers: undefined });
      expect(result).toBe('v2/spaces/spc_personal/blobs/generations/covers/cover.webp');
    });

    it('should create cover from relative stable file proxy URL', async () => {
      const coverUrl = '/f/file-1';
      const readableUrl = 'https://blob.example.com/v2/spaces/spc_personal/blobs/source.png';

      const mockBuffer = Buffer.from('original image data');
      const mockArrayBuffer = mockBuffer.buffer.slice(
        mockBuffer.byteOffset,
        mockBuffer.byteOffset + mockBuffer.byteLength,
      );
      mockFileService.getFullFileUrl.mockResolvedValueOnce(readableUrl);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      });

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockCoverBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 256,
        thumbnailHeight: 192,
      });

      mockFileService.createOpaqueUserBlobPath.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });
      mockFileService.uploadMedia.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });

      const result = await service.createCoverFromUrl(coverUrl);

      expect(mockFileService.getFullFileUrl).toHaveBeenCalledWith(coverUrl);
      expect(mockFetch).toHaveBeenCalledWith(readableUrl, { headers: undefined });
      expect(result).toBe('v2/spaces/spc_personal/blobs/generations/covers/cover.webp');
    });

    it('should create cover from shared file proxy URL via provider-readable helper', async () => {
      const coverUrl = '/share/f/share-token-1?password=secret';
      const readableUrl = 'https://blob.example.com/v2/spaces/spc_personal/blobs/source.png';

      const mockBuffer = Buffer.from('original image data');
      const mockArrayBuffer = mockBuffer.buffer.slice(
        mockBuffer.byteOffset,
        mockBuffer.byteOffset + mockBuffer.byteLength,
      );
      mockResolveProviderReadableFileReference.mockResolvedValueOnce({
        fileId: 'file-share-1',
        key: 'v2/spaces/spc_personal/blobs/source.png',
        url: readableUrl,
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      });

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockCoverBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 256,
        thumbnailHeight: 192,
      });

      mockFileService.createOpaqueUserBlobPath.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });
      mockFileService.uploadMedia.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });

      const result = await service.createCoverFromUrl(coverUrl);

      expect(mockResolveProviderReadableFileReference).toHaveBeenCalledWith({
        db: mockDb,
        fileService: mockFileService,
        sourceIp: null,
        url: coverUrl,
        userAgent: null,
        userId: mockUserId,
        via: 'generation_cover_input',
      });
      expect(mockFileService.getFullFileUrl).not.toHaveBeenCalledWith(coverUrl);
      expect(mockFetch).toHaveBeenCalledWith(readableUrl, { headers: undefined });
      expect(result).toBe('v2/spaces/spc_personal/blobs/generations/covers/cover.webp');
    });

    it('should create cover from canonical blob key', async () => {
      const coverKey = 'v2/spaces/spc_personal/blobs/generations/images/input.png';
      const readableUrl =
        'https://blob.example.com/v2/spaces/spc_personal/blobs/generations/images/input.png';

      const mockBuffer = Buffer.from('original image data');
      const mockArrayBuffer = mockBuffer.buffer.slice(
        mockBuffer.byteOffset,
        mockBuffer.byteOffset + mockBuffer.byteLength,
      );
      mockFileService.getFullFileUrl.mockResolvedValueOnce(readableUrl);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/png'),
        },
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
      });

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockCoverBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 256,
        thumbnailHeight: 192,
      });

      mockFileService.createOpaqueUserBlobPath.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });
      mockFileService.uploadMedia.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });

      const result = await service.createCoverFromUrl(coverKey);

      expect(mockFileService.getFullFileUrl).toHaveBeenCalledWith(coverKey);
      expect(mockFetch).toHaveBeenCalledWith(readableUrl, { headers: undefined });
      expect(result).toBe('v2/spaces/spc_personal/blobs/generations/covers/cover.webp');
    });

    it('should throw error for invalid image format', async () => {
      const dataUri = 'data:image/png;base64,invalid-data';

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ width: null, height: null }),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);

      await expect(service.createCoverFromUrl(dataUri)).rejects.toThrow(
        'Invalid image format for cover creation',
      );
    });

    it('should validate cover file naming format includes dimensions', async () => {
      const dataUri = 'data:image/jpeg;base64,some-data';

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({ width: 1024, height: 768 }),
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(mockCoverBuffer),
      };
      vi.mocked(sharp).mockReturnValue(mockSharp as any);
      vi.mocked(calculateThumbnailDimensions).mockReturnValue({
        shouldResize: true,
        thumbnailWidth: 256,
        thumbnailHeight: 192,
      });

      mockFileService.createOpaqueUserBlobPath.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });
      mockFileService.uploadMedia.mockResolvedValueOnce({
        key: 'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
      });

      const result = await service.createCoverFromUrl(dataUri);

      expect(mockFileService.createOpaqueUserBlobPath).toHaveBeenCalledWith(
        'generations/covers',
        'webp',
      );
      expect(mockFileService.uploadMedia).toHaveBeenCalledWith(
        'v2/spaces/spc_personal/blobs/generations/covers/cover.webp',
        mockCoverBuffer,
      );
      expect(result).toBe('v2/spaces/spc_personal/blobs/generations/covers/cover.webp');
    });
  });
});
