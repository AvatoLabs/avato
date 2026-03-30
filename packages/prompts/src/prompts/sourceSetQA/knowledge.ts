import type { AgentSourceItem } from '@lobechat/types';

const knowledgePrompt = (item: AgentSourceItem) =>
  `<knowledge id="${item.id}" name="${item.name}" type="${item.type}"${item.fileType ? ` fileType="${item.fileType}" ` : ''}>${item.description || ''}</knowledge>`;

export const knowledgePrompts = (list?: AgentSourceItem[]) => {
  if ((list || []).length === 0) return '';

  const prompt = `<source_sets>
<source_sets_docstring>here are the source sets we retrieve chunks from:</source_sets_docstring>
${list?.map((item) => knowledgePrompt(item)).join('\n')}
</source_sets>`;

  return prompt.trim();
};
