import { PAGE_FILE_TYPE } from '@/features/ContentManager/constants';

import { isMarkdownContentFile } from './isMarkdownContentFile';

export interface ResourceKind {
  baseName: string;
  emoji: string | null;
  extension: string;
  isFolder: boolean;
  isImage?: boolean;
  isMarkdown: boolean;
  isOfficeFile: boolean;
  isPage: boolean;
  isPDF: boolean;
  isSupportedForChunking?: boolean;
}

export interface ResolveResourceKindParams {
  fileType?: string | null;
  isFolder?: boolean;
  metadata?: { emoji?: string } | null;
  name?: string | null;
  sourceType?: string | null;
}

/**
 * Unified utility function to compute resource kind properties.
 * Consolidates duplicate logic from ListItem, MasonryItem, and HierarchyNode.
 */
export function resolveResourceKind(params: ResolveResourceKindParams): ResourceKind {
  const { name, fileType, sourceType, metadata, isFolder: isFolderParam } = params;

  const lowerFileType = fileType?.toLowerCase();
  const lowerName = name?.toLowerCase();

  const isPDF = lowerFileType === 'pdf' || lowerName?.endsWith('.pdf') || false;

  const isOfficeFile =
    lowerName?.endsWith('.xls') ||
    lowerName?.endsWith('.xlsx') ||
    lowerName?.endsWith('.doc') ||
    lowerName?.endsWith('.docx') ||
    lowerName?.endsWith('.ppt') ||
    lowerName?.endsWith('.pptx') ||
    lowerName?.endsWith('.odt') ||
    false;

  const isFolder = isFolderParam ?? fileType === 'custom/folder';

  const isPage =
    !isPDF && !isOfficeFile && (sourceType === 'document' || fileType === PAGE_FILE_TYPE);

  const isMarkdown = isMarkdownContentFile(name, fileType);

  const lastDotIndex = name?.lastIndexOf('.') ?? -1;
  const hasExtension = !isFolder && !isPage && lastDotIndex > 0;
  const baseName = hasExtension ? (name?.slice(0, lastDotIndex) ?? '') : (name ?? '');
  const extension = hasExtension ? (name?.slice(lastDotIndex) ?? '') : '';

  const emoji = isPage ? (metadata?.emoji ?? null) : null;

  return {
    baseName,
    emoji,
    extension,
    isFolder,
    isMarkdown,
    isOfficeFile,
    isPage,
    isPDF,
  };
}
