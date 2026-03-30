/**
 * Mobile Builtin Tools — registry and dispatch for tool-specific renders.
 * Aligned with Web getBuiltinRender; each tool has RN-specific implementation.
 */

import type React from 'react';

import CalculatorRender from './calculator/Calculator';
import CloudSandboxExecuteCode from './cloudSandbox/ExecuteCode';
import GenericFallbackRender from './fallback/GenericFallback';
import GroupManagementBroadcast from './groupManagement/Broadcast';
import GroupManagementSpeak from './groupManagement/Speak';
import GTDCreatePlan from './gtd/CreatePlan';
import GTDExecTask from './gtd/ExecTask';
import GTDExecTasks from './gtd/ExecTasks';
import GTDTodoList from './gtd/TodoList';
import MemoryAddExperience from './memory/AddExperienceMemory';
import MemoryAddPreference from './memory/AddPreferenceMemory';
import MemorySearchUser from './memory/SearchUserMemory';
import NotebookCreateDocument from './notebook/CreateDocument';
import SkillStoreSearchSkill from './skillStore/SearchSkill';
import SourceSetSearchRender from './sourceSet/SearchSourceSet';
import type { MobileBuiltinRender, MobileBuiltinRenderProps } from './types';
import WebBrowsingSearchResult from './webBrowsing/SearchResult';

const AGENT_BUILDER_ID = 'lobe-agent-builder';
const AGENT_MANAGEMENT_ID = 'lobe-agent-management';
const CALCULATOR_ID = 'lobe-calculator';
const CLOUD_SANDBOX_ID = 'lobe-cloud-sandbox';
const GROUP_AGENT_BUILDER_ID = 'lobe-group-agent-builder';
const GTD_ID = 'lobe-gtd';
const GROUP_MANAGEMENT_ID = 'lobe-group-management';
const SOURCE_SET_ID = 'lobe-source-set';
const LOCAL_SYSTEM_ID = 'lobe-local-system';
const MEMORY_ID = 'lobe-user-memory';
const NOTEBOOK_ID = 'lobe-notebook';
const SKILLS_ID = 'lobe-skills';
const SKILL_STORE_ID = 'lobe-skill-store';
const WEB_BROWSING_ID = 'lobe-web-browsing';

const GTDApiName = {
  clearTodos: 'clearTodos',
  createPlan: 'createPlan',
  createTodos: 'createTodos',
  execTask: 'execTask',
  execTasks: 'execTasks',
  updatePlan: 'updatePlan',
  updateTodos: 'updateTodos',
} as const;

const CalculatorApiName = {
  base: 'base',
  calculate: 'calculate',
  defintegrate: 'defintegrate',
  differentiate: 'differentiate',
  evaluate: 'evaluate',
  execute: 'execute',
  integrate: 'integrate',
  limit: 'limit',
  solve: 'solve',
  sort: 'sort',
} as const;

const NotebookApiName = { createDocument: 'createDocument' } as const;
const MemoryApiName = {
  addExperienceMemory: 'addExperienceMemory',
  addPreferenceMemory: 'addPreferenceMemory',
  searchUserMemory: 'searchUserMemory',
} as const;
const CloudSandboxApiName = { executeCode: 'executeCode' } as const;
const WebBrowsingApiName = { search: 'search' } as const;
const SourceSetApiName = { searchSourceSet: 'searchSourceSet' } as const;
const GroupManagementApiName = { broadcast: 'broadcast', speak: 'speak' } as const;
const SkillStoreApiName = { searchSkill: 'searchSkill' } as const;
const SkillsApiName = { searchSkill: 'searchSkill' } as const;

/** API names for tools that use GenericFallbackRender (no custom RN implementation) */
const AGENT_BUILDER_API_NAMES = [
  'getAvailableModels',
  'installPlugin',
  'searchMarketTools',
  'updateConfig',
  'updatePrompt',
] as const;
const AGENT_MANAGEMENT_API_NAMES = [
  'callAgent',
  'createAgent',
  'deleteAgent',
  'searchAgent',
  'updateAgent',
] as const;
const GROUP_AGENT_BUILDER_API_NAMES = [
  'batchCreateAgents',
  'createAgent',
  'getAgentInfo',
  'getAvailableModels',
  'installPlugin',
  'inviteAgent',
  'removeAgent',
  'searchAgent',
  'searchMarketTools',
  'updateAgentPrompt',
  'updateConfig',
  'updateGroup',
  'updateGroupPrompt',
] as const;
const LOCAL_SYSTEM_API_NAMES = [
  'editLocalFile',
  'getCommandOutput',
  'globLocalFiles',
  'grepContent',
  'killCommand',
  'listLocalFiles',
  'moveLocalFiles',
  'readLocalFile',
  'renameLocalFile',
  'runCommand',
  'searchLocalFiles',
  'writeLocalFile',
] as const;

const createFallbackMap = (apiNames: readonly string[]) =>
  Object.fromEntries(apiNames.map((name) => [name, GenericFallbackRender]));

/** Registry: identifier -> apiName -> Render component */
const BUILTIN_RENDERS: Record<
  string,
  Record<string, React.ComponentType<MobileBuiltinRenderProps>>
> = {
  [CALCULATOR_ID]: {
    [CalculatorApiName.base]: CalculatorRender,
    [CalculatorApiName.calculate]: CalculatorRender,
    [CalculatorApiName.defintegrate]: CalculatorRender,
    [CalculatorApiName.differentiate]: CalculatorRender,
    [CalculatorApiName.evaluate]: CalculatorRender,
    [CalculatorApiName.execute]: CalculatorRender,
    [CalculatorApiName.integrate]: CalculatorRender,
    [CalculatorApiName.limit]: CalculatorRender,
    [CalculatorApiName.solve]: CalculatorRender,
    [CalculatorApiName.sort]: CalculatorRender,
  },
  [GTD_ID]: {
    [GTDApiName.clearTodos]: GTDTodoList,
    [GTDApiName.createPlan]: GTDCreatePlan,
    [GTDApiName.createTodos]: GTDTodoList,
    [GTDApiName.execTask]: GTDExecTask,
    [GTDApiName.execTasks]: GTDExecTasks,
    [GTDApiName.updatePlan]: GTDCreatePlan,
    [GTDApiName.updateTodos]: GTDTodoList,
  },
  [NOTEBOOK_ID]: {
    [NotebookApiName.createDocument]: NotebookCreateDocument,
  },
  [MEMORY_ID]: {
    [MemoryApiName.addExperienceMemory]: MemoryAddExperience,
    [MemoryApiName.addPreferenceMemory]: MemoryAddPreference,
    [MemoryApiName.searchUserMemory]: MemorySearchUser,
  },
  [CLOUD_SANDBOX_ID]: {
    [CloudSandboxApiName.executeCode]: CloudSandboxExecuteCode,
  },
  [WEB_BROWSING_ID]: {
    [WebBrowsingApiName.search]: WebBrowsingSearchResult,
  },
  [SOURCE_SET_ID]: {
    [SourceSetApiName.searchSourceSet]: SourceSetSearchRender,
  },
  [GROUP_MANAGEMENT_ID]: {
    [GroupManagementApiName.broadcast]: GroupManagementBroadcast,
    [GroupManagementApiName.speak]: GroupManagementSpeak,
  },
  [SKILL_STORE_ID]: {
    [SkillStoreApiName.searchSkill]: SkillStoreSearchSkill,
  },
  [SKILLS_ID]: {
    [SkillsApiName.searchSkill]: SkillStoreSearchSkill,
  },
  [AGENT_BUILDER_ID]: createFallbackMap(AGENT_BUILDER_API_NAMES),
  [AGENT_MANAGEMENT_ID]: createFallbackMap(AGENT_MANAGEMENT_API_NAMES),
  [GROUP_AGENT_BUILDER_ID]: createFallbackMap(GROUP_AGENT_BUILDER_API_NAMES),
  [LOCAL_SYSTEM_ID]: createFallbackMap(LOCAL_SYSTEM_API_NAMES),
};

/**
 * Get builtin render component for a tool. Returns undefined if no custom render.
 */
export function getMobileBuiltinRender(
  identifier?: string,
  apiName?: string,
): MobileBuiltinRender | undefined {
  if (!identifier || !apiName) return undefined;
  const toolset = BUILTIN_RENDERS[identifier];
  return toolset?.[apiName] as MobileBuiltinRender | undefined;
}

export { getMobileBuiltinDisplayName } from './displayNames';
export { getMobileBuiltinIntervention } from './interventions';
export { getMobileBuiltinStreaming } from './streamings';
export type {
  MobileBuiltinIntervention,
  MobileBuiltinInterventionProps,
  MobileBuiltinRender,
  MobileBuiltinRenderProps,
  MobileBuiltinStreaming,
  MobileBuiltinStreamingProps,
} from './types';
