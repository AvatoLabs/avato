export const isMarkdownContentFile = (name?: string | null, fileType?: string | null) => {
  const lowerFileName = name?.toLowerCase();
  const lowerFileType = fileType?.toLowerCase();

  if (lowerFileName?.endsWith('.md') || lowerFileName?.endsWith('.markdown')) {
    return true;
  }

  if (!lowerFileType) return false;

  return (
    lowerFileType === 'md' ||
    lowerFileType === 'markdown' ||
    lowerFileType === 'text/markdown' ||
    lowerFileType === 'text/x-markdown' ||
    lowerFileType === 'application/markdown'
  );
};
