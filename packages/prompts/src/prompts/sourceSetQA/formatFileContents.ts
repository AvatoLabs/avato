import { escapeXmlAttr, escapeXmlContent } from '../search/xmlEscape';

export interface FileContent {
  content: string;
  error?: string;
  fileId: string;
  filename: string;
}

/**
 * Formats a single file content with XML tags
 */
const formatFileContent = (file: FileContent): string => {
  if (file.error) {
    return `<file id="${escapeXmlAttr(file.fileId)}" name="${escapeXmlAttr(file.filename)}" error="${escapeXmlAttr(file.error)}" />`;
  }

  return `<file id="${escapeXmlAttr(file.fileId)}" name="${escapeXmlAttr(file.filename)}">
${escapeXmlContent(file.content)}
</file>`;
};

/**
 * Format file contents prompt for AI consumption using XML structure
 */
export const promptFileContents = (fileContents: FileContent[]): string => {
  const filesXml = fileContents.map((file) => formatFileContent(file)).join('\n');

  return `<source_set_files totalCount="${fileContents.length}">
<instruction>Use the information from these files to answer the user's question. Always cite the source files.</instruction>
${filesXml}
</source_set_files>`;
};
