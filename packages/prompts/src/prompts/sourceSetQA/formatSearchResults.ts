import { escapeXmlAttr, escapeXmlContent } from '../search/xmlEscape';

export interface FileSearchResultChunk {
  similarity: number;
  text: string;
}

export interface FileSearchResult {
  fileId: string;
  fileName: string;
  relevanceScore: number;
  topChunks: FileSearchResultChunk[];
}

/**
 * Formats a single chunk with XML tags
 */
const formatChunk = (chunk: FileSearchResultChunk, fileId: string, fileName: string): string => {
  return `<chunk fileId="${escapeXmlAttr(fileId)}" fileName="${escapeXmlAttr(fileName)}" similarity="${escapeXmlAttr(String(chunk.similarity))}">${escapeXmlContent(chunk.text)}</chunk>`;
};

/**
 * Formats a single file search result with XML tags
 */
const formatFile = (file: FileSearchResult): string => {
  const chunks = file.topChunks.map((chunk) => formatChunk(chunk, file.fileId, file.fileName));

  return `<file id="${escapeXmlAttr(file.fileId)}" name="${escapeXmlAttr(file.fileName)}" relevanceScore="${escapeXmlAttr(String(file.relevanceScore))}">
${chunks.join('\n')}
</file>`;
};

/**
 * Formats source-set search results into an XML structure
 * @param fileResults - Array of file search results with relevance scores and chunks
 * @param query - The original search query
 * @returns Formatted XML string with search results
 */
export const formatSearchResults = (fileResults: FileSearchResult[], query: string): string => {
  if (fileResults.length === 0) {
    return `<source_set_search_results query="${escapeXmlAttr(query)}" totalCount="0">
<instruction>No relevant files found in the configured source sets for this query.</instruction>
</source_set_search_results>`;
  }

  const filesXml = fileResults.map((file) => formatFile(file)).join('\n');

  return `<source_set_search_results query="${escapeXmlAttr(query)}" totalCount="${fileResults.length}">
<instruction>Here are the search results from the configured source sets. Use the readSourceFiles tool with file IDs to get complete content.</instruction>
${filesXml}
</source_set_search_results>`;
};
