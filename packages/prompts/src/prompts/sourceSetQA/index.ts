import type { AgentSourceItem, ChatSemanticSearchChunk } from '@lobechat/types';

import { chunkPrompts } from './chunk';
import { knowledgePrompts } from './knowledge';
import { userQueryPrompt } from './userQuery';

export type { FileContent } from './formatFileContents';
export { promptFileContents } from './formatFileContents';
export { promptNoSearchResults } from './formatNoSearchResults';
export type { FileSearchResult, FileSearchResultChunk } from './formatSearchResults';
export { formatSearchResults } from './formatSearchResults';

export const sourceSetQAPrompts = ({
  chunks,
  knowledge,
  userQuery,
  rewriteQuery,
}: {
  chunks?: ChatSemanticSearchChunk[];
  knowledge?: AgentSourceItem[];
  rewriteQuery?: string;
  userQuery: string;
}) => {
  if ((chunks || [])?.length === 0) return '';

  const domains = (knowledge || []).map((v) => v.name).join('/');

  return `<source_set_qa_info>
You are also a helpful assistant at answering questions related to ${domains}. You will be given a question and several passages that might be relevant. Your task is to answer based on the question and passages.
<source_set_answer_instruction>
- Note that passages might not be relevant to the question, please only use the passages that are relevant.
- if there is no relevant passage, please answer using your knowledge.
- Answer should use the same original language as the question and follow markdown syntax.
</source_set_answer_instruction>
${knowledgePrompts(knowledge)}
${chunks ? chunkPrompts(chunks) : ''}
${userQueryPrompt(userQuery, rewriteQuery)}
</source_set_qa_info>`;
};
