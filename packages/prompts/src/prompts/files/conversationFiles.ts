import type { FileContent } from '../knowledgeBaseQA';

const formatConversationFile = (file: FileContent) => {
  if (file.error) {
    return `<file id="${file.fileId}" name="${file.filename}" error="${file.error}" />`;
  }

  return `<file id="${file.fileId}" name="${file.filename}">
${file.content}
</file>`;
};

export const promptConversationFiles = (fileContents: FileContent[] = []) => {
  if (fileContents.length === 0) return '';

  return `<conversation_files totalCount="${fileContents.length}">
<instruction>The following files are attached to the current conversation only. Use them as shared context for this conversation, and prefer them when the user's request refers to attached resources.</instruction>
${fileContents.map((file) => formatConversationFile(file)).join('\n')}
</conversation_files>`;
};
