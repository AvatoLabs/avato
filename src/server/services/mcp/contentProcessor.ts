import debug from 'debug';
import pMap from 'p-map';

import { type AudioContent, type ImageContent, type ToolCallContent } from '@/libs/mcp';
import { type FileService } from '@/server/services/file';

const log = debug('lobe-mcp:content-processor');
const MCP_CONTENT_STORAGE_SCOPE = 'mcp-content';

export type ProcessContentBlocksFn = (blocks: ToolCallContent[]) => Promise<ToolCallContent[]>;

/**
 * Process content blocks returned by MCP
 * - Upload images/audio to storage and replace data with proxy URL
 * - Keep other types of blocks unchanged
 */
export const processContentBlocks = async (
  blocks: ToolCallContent[],
  fileService: FileService,
): Promise<ToolCallContent[]> => {
  return pMap(blocks, async (block) => {
    if (block.type === 'image') {
      const imageBlock = block as ImageContent;

      // Extract file extension from mimeType (e.g., "image/png" -> "png")
      const fileExtension = imageBlock.mimeType.split('/')[1] || 'png';
      const { key: pathname } = await fileService.createOpaqueUserBlobPath(
        `${MCP_CONTENT_STORAGE_SCOPE}/images`,
        fileExtension,
      );

      // Upload base64 image and get proxy URL
      const { url } = await fileService.uploadBase64(imageBlock.data, pathname);

      log(`Image uploaded, proxy URL: ${url}`);

      return { ...block, data: url };
    }

    if (block.type === 'audio') {
      const audioBlock = block as AudioContent;

      // Extract file extension from mimeType (e.g., "audio/mp3" -> "mp3")
      const fileExtension = audioBlock.mimeType.split('/')[1] || 'mp3';
      const { key: pathname } = await fileService.createOpaqueUserBlobPath(
        `${MCP_CONTENT_STORAGE_SCOPE}/audio`,
        fileExtension,
      );

      // Upload base64 audio and get proxy URL
      const { url } = await fileService.uploadBase64(audioBlock.data, pathname);

      log(`Audio uploaded, proxy URL: ${url}`);

      return { ...block, data: url };
    }

    return block;
  });
};

/**
 * Convert content blocks to string
 * - text: Extract text field
 * - image/audio: Extract data field (usually the proxy URL after upload)
 * - others: Return empty string
 */
export const contentBlocksToString = (blocks: ToolCallContent[] | null | undefined): string => {
  if (!blocks) return '';

  return blocks
    .map((item) => {
      switch (item.type) {
        case 'text': {
          return item.text;
        }

        case 'image': {
          return `![](${item.data})`;
        }

        case 'audio': {
          return `<resource type="${item.type}" url="${item.data}" />`;
        }

        case 'resource': {
          return `<resource type="${item.type}">${JSON.stringify(item.resource)}</content>}`;
        }

        default: {
          return '';
        }
      }
    })
    .filter(Boolean)
    .join('\n\n');
};
