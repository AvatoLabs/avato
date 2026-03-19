/**
 * Mobile Builtin Tools — Streaming placeholder registry.
 * Shown when tool is executing (no result yet) for real-time feedback.
 */

import type React from 'react';

import type { MobileBuiltinStreamingProps } from './types';

import CloudSandboxExecuteCodeStreaming from './cloudSandbox/streamings/ExecuteCode';
import KnowledgeBaseSearchKnowledgeBaseStreaming from './knowledgeBase/streamings/SearchKnowledgeBase';
import SkillStoreSearchSkillStreaming from './skillStore/streamings/SearchSkill';
import GTDCreatePlanStreaming from './gtd/streamings/CreatePlan';
import GTDExecTaskStreaming from './gtd/streamings/ExecTask';
import GTDExecTasksStreaming from './gtd/streamings/ExecTasks';
import MemoryAddExperienceStreaming from './memory/streamings/AddExperienceMemory';
import MemoryAddPreferenceStreaming from './memory/streamings/AddPreferenceMemory';
import NotebookCreateDocumentStreaming from './notebook/streamings/CreateDocument';
import WebBrowsingSearchStreaming from './webBrowsing/streamings/Search';

const GTD_ID = 'lobe-gtd';
const NOTEBOOK_ID = 'lobe-notebook';
const MEMORY_ID = 'lobe-user-memory';
const CLOUD_SANDBOX_ID = 'lobe-cloud-sandbox';
const WEB_BROWSING_ID = 'lobe-web-browsing';
const KNOWLEDGE_BASE_ID = 'lobe-knowledge-base';
const SKILL_STORE_ID = 'lobe-skill-store';
const SKILLS_ID = 'lobe-skills';

const GTDApiName = {
  createPlan: 'createPlan',
  execTask: 'execTask',
  execTasks: 'execTasks',
} as const;
const NotebookApiName = { createDocument: 'createDocument' } as const;
const MemoryApiName = {
  addExperienceMemory: 'addExperienceMemory',
  addPreferenceMemory: 'addPreferenceMemory',
} as const;
const CloudSandboxApiName = { executeCode: 'executeCode' } as const;
const WebBrowsingApiName = { search: 'search' } as const;
const KnowledgeBaseApiName = { searchKnowledgeBase: 'searchKnowledgeBase' } as const;
const SkillStoreApiName = { searchSkill: 'searchSkill' } as const;
const SkillsApiName = { searchSkill: 'searchSkill' } as const;

const BUILTIN_STREAMINGS: Record<
  string,
  Record<string, React.ComponentType<MobileBuiltinStreamingProps>>
> = {
  [GTD_ID]: {
    [GTDApiName.createPlan]: GTDCreatePlanStreaming,
    [GTDApiName.execTask]: GTDExecTaskStreaming,
    [GTDApiName.execTasks]: GTDExecTasksStreaming,
  },
  [NOTEBOOK_ID]: {
    [NotebookApiName.createDocument]: NotebookCreateDocumentStreaming,
  },
  [MEMORY_ID]: {
    [MemoryApiName.addExperienceMemory]: MemoryAddExperienceStreaming,
    [MemoryApiName.addPreferenceMemory]: MemoryAddPreferenceStreaming,
  },
  [CLOUD_SANDBOX_ID]: {
    [CloudSandboxApiName.executeCode]: CloudSandboxExecuteCodeStreaming,
  },
  [WEB_BROWSING_ID]: {
    [WebBrowsingApiName.search]: WebBrowsingSearchStreaming,
  },
  [KNOWLEDGE_BASE_ID]: {
    [KnowledgeBaseApiName.searchKnowledgeBase]: KnowledgeBaseSearchKnowledgeBaseStreaming,
  },
  [SKILL_STORE_ID]: {
    [SkillStoreApiName.searchSkill]: SkillStoreSearchSkillStreaming,
  },
  [SKILLS_ID]: {
    [SkillsApiName.searchSkill]: SkillStoreSearchSkillStreaming,
  },
};

export function getMobileBuiltinStreaming(
  identifier?: string,
  apiName?: string,
): React.ComponentType<MobileBuiltinStreamingProps> | undefined {
  if (!identifier || !apiName) return undefined;
  const toolset = BUILTIN_STREAMINGS[identifier];
  return toolset?.[apiName];
}
