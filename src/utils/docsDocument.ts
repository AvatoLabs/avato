const NOTEBOOK_PAGE_FILE_TYPES = ['article', 'markdown', 'note', 'report'] as const;

export const PAGE_ENTRY_FILE_TYPES = new Set<string>([
  'application/pdf',
  'custom/document',
  ...NOTEBOOK_PAGE_FILE_TYPES,
]);

export const isPageEntryFileType = (fileType?: string | null) => {
  if (!fileType) return false;

  return PAGE_ENTRY_FILE_TYPES.has(fileType);
};
