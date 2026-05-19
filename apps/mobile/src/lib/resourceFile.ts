import type { FileListItem } from '../types';

export type ResourceCategory = 'all' | 'documents' | 'images' | 'others';

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]);

const DOCUMENT_EXTENSIONS = /\.(?:md|mdx|doc|docx|ppt|pptx|xls|xlsx|pdf|txt|rtf)$/i;

const TEXT_EXTENSIONS = new Set([
  'c',
  'cc',
  'conf',
  'cpp',
  'css',
  'csv',
  'd',
  'env',
  'go',
  'h',
  'hpp',
  'html',
  'ini',
  'java',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'mdx',
  'mjs',
  'py',
  'rb',
  'rs',
  'scss',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
]);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function hasImageExtension(fileName?: string): boolean {
  if (!fileName) return false;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return !!(ext && IMAGE_EXTENSIONS.has(ext));
}

export function isImage(fileType: string, fileName?: string): boolean {
  if (fileType.toLowerCase().startsWith('image/')) return true;
  return hasImageExtension(fileName);
}

export function isDocument(fileType: string, fileName?: string): boolean {
  const docs = ['application/pdf', 'text/', 'application/msword', 'application/vnd'];
  if (docs.some((prefix) => fileType.startsWith(prefix))) return true;
  return !!(fileName && DOCUMENT_EXTENSIONS.test(fileName));
}

export function isMarkdownFile(fileType: string, fileName?: string): boolean {
  if (fileType.includes('markdown') || fileType === 'text/mdx') return true;
  return !!(fileName && /\.(?:md|mdx)$/i.test(fileName));
}

export function isTextLikeFile(
  fileType: string,
  fileName?: string,
  sourceType?: FileListItem['sourceType'],
): boolean {
  if (
    fileType.startsWith('text/') ||
    fileType === 'application/json' ||
    fileType === 'application/javascript' ||
    fileType === 'application/xml'
  ) {
    return true;
  }

  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (ext && TEXT_EXTENSIONS.has(ext)) return true;

  if (
    sourceType === 'document' &&
    fileType !== 'application/pdf' &&
    !fileType.includes('msword') &&
    !fileType.includes('vnd.openxmlformats') &&
    !fileType.includes('vnd.ms-excel') &&
    !fileType.includes('vnd.ms-powerpoint')
  ) {
    return true;
  }

  return false;
}

export function isAudio(fileType: string): boolean {
  return fileType.startsWith('audio/');
}

export function isVideo(fileType: string): boolean {
  return fileType.startsWith('video/');
}

export function matchesCategory(item: FileListItem, category: ResourceCategory): boolean {
  if (item.fileType === 'custom/folder') return true;
  if (category === 'all') return true;
  if (category === 'images') return isImage(item.fileType, item.name);
  if (category === 'documents') return isDocument(item.fileType, item.name);
  if (category === 'others') {
    return !isImage(item.fileType, item.name) && !isDocument(item.fileType, item.name);
  }

  return true;
}
