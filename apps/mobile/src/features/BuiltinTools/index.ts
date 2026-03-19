/**
 * Mobile Builtin Tools — registry and dispatch for tool-specific renders.
 * Aligned with Web getBuiltinRender; each tool has RN-specific implementation.
 */

import type React from 'react';

import type { MobileBuiltinRender, MobileBuiltinRenderProps } from './types';

import CalculatorResult from './calculator/Result';
import CloudSandboxExecuteCode from './cloudSandbox/ExecuteCode';
import GroupManagementBroadcast from './groupManagement/Broadcast';
import GroupManagementSpeak from './groupManagement/Speak';
import GTDCreatePlan from './gtd/CreatePlan';
import SkillStoreSearchSkill from './skillStore/SearchSkill';
import KnowledgeBaseSearchKnowledgeBase from './knowledgeBase/SearchKnowledgeBase';
import WebBrowsingSearchResult from './webBrowsing/SearchResult';
import GTDExecTask from './gtd/ExecTask';
import GTDExecTasks from './gtd/ExecTasks';
import GTDTodoList from './gtd/TodoList';
import MemoryAddExperience from './memory/AddExperienceMemory';
import MemoryAddPreference from './memory/AddPreferenceMemory';
import MemorySearchUser from './memory/SearchUserMemory';
import NotebookCreateDocument from './notebook/CreateDocument';

const GTD_ID = 'lobe-gtd';
const NOTEBOOK_ID = 'lobe-notebook';
const MEMORY_ID = 'lobe-user-memory';
const CLOUD_SANDBOX_ID = 'lobe-cloud-sandbox';
const CALCULATOR_ID = 'lobe-calculator';
const WEB_BROWSING_ID = 'lobe-web-browsing';
const KNOWLEDGE_BASE_ID = 'lobe-knowledge-base';
const GROUP_MANAGEMENT_ID = 'lobe-group-management';
const SKILL_STORE_ID = 'lobe-skill-store';
const SKILLS_ID = 'lobe-skills';

const GTDApiName = {
  clearTodos: 'clearTodos',
  createPlan: 'createPlan',
  createTodos: 'createTodos',
  execTask: 'execTask',
  execTasks: 'execTasks',
  updatePlan: 'updatePlan',
  updateTodos: 'updateTodos',
} as const;

const NotebookApiName = { createDocument: 'createDocument' } as const;
const MemoryApiName = {
  addExperienceMemory: 'addExperienceMemory',
  addPreferenceMemory: 'addPreferenceMemory',
  searchUserMemory: 'searchUserMemory',
} as const;
const CloudSandboxApiName = { executeCode: 'executeCode' } as const;
const WebBrowsingApiName = { search: 'search' } as const;
const KnowledgeBaseApiName = { searchKnowledgeBase: 'searchKnowledgeBase' } as const;
const GroupManagementApiName = { broadcast: 'broadcast', speak: 'speak' } as const;
const SkillStoreApiName = { searchSkill: 'searchSkill' } as const;
const SkillsApiName = { searchSkill: 'searchSkill' } as const;
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

/** Registry: identifier -> apiName -> Render component */
const BUILTIN_RENDERS: Record<string, Record<string, React.ComponentType<MobileBuiltinRenderProps>>> =
  {
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
    [KNOWLEDGE_BASE_ID]: {
      [KnowledgeBaseApiName.searchKnowledgeBase]: KnowledgeBaseSearchKnowledgeBase,
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
    [CALCULATOR_ID]: {
      [CalculatorApiName.base]: CalculatorResult,
      [CalculatorApiName.calculate]: CalculatorResult,
      [CalculatorApiName.defintegrate]: CalculatorResult,
      [CalculatorApiName.differentiate]: CalculatorResult,
      [CalculatorApiName.evaluate]: CalculatorResult,
      [CalculatorApiName.execute]: CalculatorResult,
      [CalculatorApiName.integrate]: CalculatorResult,
      [CalculatorApiName.limit]: CalculatorResult,
      [CalculatorApiName.solve]: CalculatorResult,
      [CalculatorApiName.sort]: CalculatorResult,
    },
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
