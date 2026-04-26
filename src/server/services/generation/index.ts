import { type LobeChatDatabase } from '@lobechat/database';
import { parseDataUri } from '@lobechat/model-runtime';
import debug from 'debug';
import { sha256 } from 'js-sha256';
import mime from 'mime';
import { IMAGE_GENERATION_CONFIG } from 'model-bank';
import sharp from 'sharp';

import { FileService } from '@/server/services/file';
import { resolveRuntimeFileInput } from '@/server/services/file/resolveRuntimeFileInput';
import { calculateThumbnailDimensions } from '@/utils/number';
import { inferFileExtensionFromImageUrl } from '@/utils/url';

const log = debug('lobe-image:generation-service');

/**
 * Fetch image buffer and MIME type from URL or base64 data
 * @param url - Image URL or base64 data URI
 * @param fetchHeaders - Optional headers for authentication
 * @returns Object containing buffer and MIME type
 */
export async function fetchImageFromUrl(
  url: string,
  fetchHeaders?: Record<string, string>,
): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  if (url.startsWith('data:')) {
    log('Data URI length:', url.length);

    log('parseDataUri: start');
    const { base64, mimeType, type } = parseDataUri(url);
    log('parseDataUri: done, base64 length:', base64?.length, 'mimeType:', mimeType);

    if (type !== 'base64' || !base64 || !mimeType) {
      throw new Error(`Invalid data URI format: ${url}`);
    }

    try {
      log('Buffer.from base64: start');
      const buffer = Buffer.from(base64, 'base64');
      log('Buffer.from base64: done, buffer size:', buffer.length);
      return { buffer, mimeType };
    } catch (error) {
      throw new Error(
        `Failed to decode base64 data: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  } else {
    const response = await fetch(url, { headers: fetchHeaders });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image from ${url}: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    return { buffer, mimeType };
  }
}

interface ImageForGeneration {
  buffer: Buffer;
  extension: string;
  height: number;
  mime: string;
  sha256: string;
  size: number;
  width: number;
}

/**
 * Image generation service
 * Handles conversion, upload and cover creation for AI-generated images
 */
export class GenerationService {
  private db: LobeChatDatabase;

  private fileService: FileService;

  private userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.fileService = new FileService(db, userId);
    this.userId = userId;
  }

  private createGenerationBlobPath(scope: 'covers' | 'images', extension: string) {
    return this.fileService.createOpaqueUserBlobPath(`generations/${scope}`, extension);
  }

  private async resolveFetchableImageUrl(url: string, via: string) {
    if (url.startsWith('data:')) return url;

    const resolvedInput = await resolveRuntimeFileInput({
      db: this.db,
      fileService: this.fileService,
      url,
      userId: this.userId,
      via,
    });

    if (resolvedInput) {
      return resolvedInput.url;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    return this.fileService.getFullFileUrl(url);
  }

  /**
   * Generate width 512px image as thumbnail when width > 512, end with _512.webp
   */
  async transformImageForGeneration(
    url: string,
    fetchHeaders?: Record<string, string>,
  ): Promise<{
    image: ImageForGeneration;
    thumbnailImage: ImageForGeneration;
  }> {
    log('Starting image transformation for:', url.startsWith('data:') ? 'base64 data' : url);

    const fetchableUrl = await this.resolveFetchableImageUrl(url, 'image_generation_input');

    // Fetch image buffer and MIME type using utility function
    log('fetchImageFromUrl: start');
    const { buffer: originalImageBuffer, mimeType: originalMimeType } = await fetchImageFromUrl(
      fetchableUrl,
      fetchHeaders,
    );
    log('fetchImageFromUrl: done, buffer size:', originalImageBuffer.length);

    // Calculate hash for original image
    log('sha256: start');
    const originalSha256 = sha256(originalImageBuffer);
    log('sha256: done');

    log('sharp metadata: start');
    const sharpInstance = sharp(originalImageBuffer);
    const { format, width, height } = await sharpInstance.metadata();
    log('Image metadata:', { format, height, width });

    if (!width || !height) {
      throw new Error(`Invalid image format: ${format}, url: ${url}`);
    }

    const {
      shouldResize: shouldResizeBySize,
      thumbnailWidth,
      thumbnailHeight,
    } = calculateThumbnailDimensions(width, height);
    const shouldResize = shouldResizeBySize || format !== 'webp';

    log('Thumbnail processing decision:', {
      format,
      shouldResize,
      shouldResizeBySize,
      thumbnailHeight,
      thumbnailWidth,
    });

    const thumbnailBuffer = shouldResize
      ? await sharpInstance.resize(thumbnailWidth, thumbnailHeight).webp().toBuffer()
      : originalImageBuffer;

    // Calculate hash for thumbnail
    const thumbnailSha256 = sha256(thumbnailBuffer);

    log('Image transformation completed successfully');

    // Determine extension using url utility
    let extension: string;
    if (url.startsWith('data:')) {
      const mimeExtension = mime.getExtension(originalMimeType);
      if (!mimeExtension) {
        throw new Error(`Unable to determine file extension for MIME type: ${originalMimeType}`);
      }
      extension = mimeExtension;
    } else {
      // Try to get extension from URL path first
      extension = inferFileExtensionFromImageUrl(url);

      // For ComfyUI URLs, check filename in query parameters
      if (!extension && url.includes('filename=')) {
        try {
          const urlObj = new URL(url);
          const filename = urlObj.searchParams.get('filename');
          if (filename) {
            extension = inferFileExtensionFromImageUrl(filename);
          }
        } catch {
          // Ignore URL parsing errors
        }
      }

      // If still no extension, try to get from MIME type
      if (!extension && originalMimeType && originalMimeType !== 'application/octet-stream') {
        const mimeExtension = mime.getExtension(originalMimeType);
        if (mimeExtension) {
          extension = mimeExtension;
        }
      }

      if (!extension) {
        throw new Error(`Unable to determine file extension from URL: ${url}`);
      }
    }

    return {
      image: {
        buffer: originalImageBuffer,
        extension,
        height,
        mime: originalMimeType,
        sha256: originalSha256,
        size: originalImageBuffer.length,
        width,
      },
      thumbnailImage: {
        buffer: thumbnailBuffer,
        extension: 'webp',
        height: thumbnailHeight,
        mime: 'image/webp',
        sha256: thumbnailSha256,
        size: thumbnailBuffer.length,
        width: thumbnailWidth,
      },
    };
  }

  async uploadImageForGeneration(image: ImageForGeneration, thumbnail: ImageForGeneration) {
    log('Starting image upload for generation');

    // Check if image and thumbnail buffers are identical
    const isIdenticalBuffer = image.buffer.equals(thumbnail.buffer);
    log('Buffer comparison:', {
      imageSize: image.buffer.length,
      isIdenticalBuffer,
      thumbnailSize: thumbnail.buffer.length,
    });

    if (isIdenticalBuffer) {
      log('Buffers are identical, uploading single image');
      const { key: imageKey } = await this.createGenerationBlobPath('images', image.extension);
      // If buffers are identical, only upload once
      const result = await this.fileService.uploadMedia(imageKey, image.buffer);
      log('Single image uploaded successfully:', result.key);
      // Use the same key for both image and thumbnail
      return {
        imageUrl: result.key,
        thumbnailImageUrl: result.key,
      };
    } else {
      log('Buffers are different, uploading both images');
      const [{ key: imageKey }, { key: thumbnailKey }] = await Promise.all([
        this.createGenerationBlobPath('images', image.extension),
        this.createGenerationBlobPath('images', thumbnail.extension),
      ]);
      // If buffers are different, upload both
      const [imageResult, thumbnailResult] = await Promise.all([
        this.fileService.uploadMedia(imageKey, image.buffer),
        this.fileService.uploadMedia(thumbnailKey, thumbnail.buffer),
      ]);

      log('Both images uploaded successfully:', {
        imageUrl: imageResult.key,
        thumbnailImageUrl: thumbnailResult.key,
      });

      return {
        imageUrl: imageResult.key,
        thumbnailImageUrl: thumbnailResult.key,
      };
    }
  }

  /**
   * Create a cover image from a given URL and upload
   * @param coverUrl - The source image URL, internal proxy, blob key, or base64 data URI
   * @returns The key of the uploaded cover image
   */
  async createCoverFromUrl(coverUrl: string): Promise<string> {
    log('Creating cover image from URL:', coverUrl.startsWith('data:') ? 'base64 data' : coverUrl);

    const fetchableUrl = await this.resolveFetchableImageUrl(coverUrl, 'generation_cover_input');

    // Fetch image buffer using utility function
    const { buffer: originalImageBuffer } = await fetchImageFromUrl(fetchableUrl);

    // Get image metadata to calculate proper cover dimensions
    const sharpInstance = sharp(originalImageBuffer);
    const { width, height } = await sharpInstance.metadata();

    if (!width || !height) {
      throw new Error('Invalid image format for cover creation');
    }

    // Calculate cover dimensions maintaining aspect ratio with configurable max size
    const { thumbnailWidth, thumbnailHeight } = calculateThumbnailDimensions(
      width,
      height,
      IMAGE_GENERATION_CONFIG.COVER_MAX_SIZE,
    );

    log('Processing cover image with dimensions:', {
      cover: { height: thumbnailHeight, width: thumbnailWidth },
      original: { height, width },
    });

    const coverBuffer = await sharpInstance
      .resize(thumbnailWidth, thumbnailHeight)
      .webp()
      .toBuffer();

    log('Cover image processed, final size:', coverBuffer.length);

    // Upload using FileService
    const { key: coverKey } = await this.createGenerationBlobPath('covers', 'webp');

    log('Uploading cover image:', coverKey);
    const result = await this.fileService.uploadMedia(coverKey, coverBuffer);

    log('Cover image uploaded successfully:', result.key);
    return result.key;
  }
}
