import { escapeXmlAttr, escapeXmlContent } from '../search/xmlEscape';
import type { FileContent } from '../sourceSetQA';

export interface SourceSetInfo {
  description?: string | null;
  id: string;
  name: string;
}

export interface PromptAgentSourcesOptions {
  /** File contents to inject */
  fileContents?: FileContent[];
  /** Source-set metadata to include */
  sourceSets?: SourceSetInfo[];
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
 * Format agent sources (files + source sets) as unified XML prompt
 */
export const promptAgentSources = ({
  fileContents = [],
  sourceSets = [],
}: PromptAgentSourcesOptions) => {
  const hasFiles = fileContents.length > 0;
  const hasSourceSets = sourceSets.length > 0;

  // If no knowledge at all, return empty
  if (!hasFiles && !hasSourceSets) {
    return '';
  }

  const contentParts: string[] = [];

  // Add instruction based on what's available
  if (hasFiles && hasSourceSets) {
    contentParts.push(
      '<instruction>The following files and source sets are available. For files, refer to their content directly. For source sets, use the searchSourceSet tool to find relevant information.</instruction>',
    );
  } else if (hasFiles) {
    contentParts.push(
      '<instruction>The following files are available. Refer to their content directly to answer questions. No source sets are associated.</instruction>',
    );
  } else {
    contentParts.push(
      '<instruction>The following source sets are available for semantic search. Use the searchSourceSet tool to find relevant information.</instruction>',
    );
  }

  // Add files section
  if (hasFiles) {
    const filesXml = fileContents.map((file) => formatFileContent(file)).join('\n');
    contentParts.push(`<files totalCount="${fileContents.length}">
${filesXml}
</files>`);
  }

  // Add source-sets section
  if (hasSourceSets) {
    const sourceSetItems = sourceSets
      .map(
        (sourceSet) =>
          `<source_set id="${escapeXmlAttr(sourceSet.id)}" name="${escapeXmlAttr(sourceSet.name)}"${sourceSet.description ? ` description="${escapeXmlAttr(sourceSet.description)}"` : ''} />`,
      )
      .join('\n');
    contentParts.push(`<source_sets totalCount="${sourceSets.length}">
${sourceSetItems}
</source_sets>`);
  }

  return `<agent_knowledge>
${contentParts.join('\n')}
</agent_knowledge>`;
};
