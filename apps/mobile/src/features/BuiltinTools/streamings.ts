/**
 * Mobile Builtin Tools — Streaming placeholder registry.
 * Shown when tool is executing (no result yet) for real-time feedback.
 * RN aligned with Web: agent-builder, agent-management, group-agent-builder, local-system, etc.
 */

import type React from 'react';

import CloudSandboxExecuteCodeStreaming from './cloudSandbox/streamings/ExecuteCode';
import GenericFallbackStreaming from './fallback/GenericFallbackStreaming';
import GroupManagementBroadcastStreaming from './groupManagement/streamings/Broadcast';
import GroupManagementSpeakStreaming from './groupManagement/streamings/Speak';
import GTDCreatePlanStreaming from './gtd/streamings/CreatePlan';
import GTDExecTaskStreaming from './gtd/streamings/ExecTask';
import GTDExecTasksStreaming from './gtd/streamings/ExecTasks';
import KnowledgeBaseSearchKnowledgeBaseStreaming from './knowledgeBase/streamings/SearchKnowledgeBase';
import MemoryAddExperienceStreaming from './memory/streamings/AddExperienceMemory';
import MemoryAddPreferenceStreaming from './memory/streamings/AddPreferenceMemory';
import NotebookCreateDocumentStreaming from './notebook/streamings/CreateDocument';
import SkillStoreSearchSkillStreaming from './skillStore/streamings/SearchSkill';
import type { MobileBuiltinStreamingProps } from './types';
import WebBrowsingSearchStreaming from './webBrowsing/streamings/Search';

const AGENT_BUILDER_ID = 'lobe-agent-builder';
const AGENT_MANAGEMENT_ID = 'lobe-agent-management';
const GROUP_AGENT_BUILDER_ID = 'lobe-group-agent-builder';
const GROUP_MANAGEMENT_ID = 'lobe-group-management';
const LOCAL_SYSTEM_ID = 'lobe-local-system';
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
const GroupManagementApiName = {
  broadcast: 'broadcast',
  executeAgentTask: 'executeAgentTask',
  executeAgentTasks: 'executeAgentTasks',
  speak: 'speak',
} as const;
const WebBrowsingApiName = { search: 'search' } as const;
const KnowledgeBaseApiName = { searchKnowledgeBase: 'searchKnowledgeBase' } as const;
const SkillStoreApiName = { searchSkill: 'searchSkill' } as const;
const SkillsApiName = { searchSkill: 'searchSkill' } as const;

const BUILTIN_STREAMINGS: Record<
  string,
  Record<string, React.ComponentType<MobileBuiltinStreamingProps>>
> = {
  [GROUP_MANAGEMENT_ID]: {
    [GroupManagementApiName.broadcast]: GroupManagementBroadcastStreaming,
    [GroupManagementApiName.executeAgentTask]: GenericFallbackStreaming,
    [GroupManagementApiName.executeAgentTasks]: GenericFallbackStreaming,
    [GroupManagementApiName.speak]: GroupManagementSpeakStreaming,
  },
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
  // GenericFallbackStreaming for tools with Web streaming but no custom RN component
  [AGENT_BUILDER_ID]: {
    getAvailableModels: GenericFallbackStreaming,
    installPlugin: GenericFallbackStreaming,
    searchMarketTools: GenericFallbackStreaming,
    updateConfig: GenericFallbackStreaming,
    updatePrompt: GenericFallbackStreaming,
  },
  [AGENT_MANAGEMENT_ID]: {
    callAgent: GenericFallbackStreaming,
    createAgent: GenericFallbackStreaming,
    deleteAgent: GenericFallbackStreaming,
    searchAgent: GenericFallbackStreaming,
    updateAgent: GenericFallbackStreaming,
  },
  [GROUP_AGENT_BUILDER_ID]: {
    batchCreateAgents: GenericFallbackStreaming,
    createAgent: GenericFallbackStreaming,
    getAgentInfo: GenericFallbackStreaming,
    getAvailableModels: GenericFallbackStreaming,
    installPlugin: GenericFallbackStreaming,
    inviteAgent: GenericFallbackStreaming,
    removeAgent: GenericFallbackStreaming,
    searchAgent: GenericFallbackStreaming,
    searchMarketTools: GenericFallbackStreaming,
    updateAgentPrompt: GenericFallbackStreaming,
    updateConfig: GenericFallbackStreaming,
    updateGroup: GenericFallbackStreaming,
    updateGroupPrompt: GenericFallbackStreaming,
  },
  [LOCAL_SYSTEM_ID]: {
    editLocalFile: GenericFallbackStreaming,
    getCommandOutput: GenericFallbackStreaming,
    globLocalFiles: GenericFallbackStreaming,
    grepContent: GenericFallbackStreaming,
    killCommand: GenericFallbackStreaming,
    listLocalFiles: GenericFallbackStreaming,
    moveLocalFiles: GenericFallbackStreaming,
    readLocalFile: GenericFallbackStreaming,
    renameLocalFile: GenericFallbackStreaming,
    runCommand: GenericFallbackStreaming,
    searchLocalFiles: GenericFallbackStreaming,
    writeLocalFile: GenericFallbackStreaming,
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
