/**
 * Markdown file extensions (with leading dot)
 */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdx', '.mdown', '.mkd'];

/**
 * Markdown MIME types and short type identifiers
 */
export const MARKDOWN_MIME_TYPES = new Set([
  'md',
  'markdown',
  'mdx',
  'mdown',
  'mkd',
  'text/markdown',
  'text/x-markdown',
  'application/markdown',
]);

export const isMarkdownContentFile = (name?: string | null, fileType?: string | null) => {
  const lowerFileName = name?.toLowerCase();
  const lowerFileType = fileType?.toLowerCase();

  // Check file extension
  if (lowerFileName && MARKDOWN_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext))) {
    return true;
  }

  // Check MIME type
  if (lowerFileType && MARKDOWN_MIME_TYPES.has(lowerFileType)) {
    return true;
  }

  return false;
};
