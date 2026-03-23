/**
 * Mobile Builtin Tools — Intervention registry for pending tool edit forms.
 * When tool is pending and we have an Intervention, show it above approve/reject buttons.
 * RN aligned with Web: group-management, agent-builder, local-system use GenericFallbackIntervention.
 */

import type React from 'react';

import CloudSandboxExecuteCode from './cloudSandbox/interventions/ExecuteCode';
import GenericFallbackIntervention from './fallback/GenericFallbackIntervention';
import GTDAddTodo from './gtd/interventions/AddTodo';
import GTDClearTodos from './gtd/interventions/ClearTodos';
import GTDCreatePlan from './gtd/interventions/CreatePlan';
import MemoryAddExperience from './memory/interventions/AddExperienceMemory';
import NotebookCreateDocument from './notebook/interventions/CreateDocument';
import type { MobileBuiltinInterventionProps } from './types';

const AGENT_BUILDER_ID = 'lobe-agent-builder';
const CLOUD_SANDBOX_ID = 'lobe-cloud-sandbox';
const GROUP_MANAGEMENT_ID = 'lobe-group-management';
const GTD_ID = 'lobe-gtd';
const LOCAL_SYSTEM_ID = 'lobe-local-system';
const MEMORY_ID = 'lobe-user-memory';
const NOTEBOOK_ID = 'lobe-notebook';

const AgentBuilderApiName = { installPlugin: 'installPlugin' } as const;
const CloudSandboxApiName = { executeCode: 'executeCode' } as const;
const GroupManagementApiName = {
  executeAgentTask: 'executeAgentTask',
  executeAgentTasks: 'executeAgentTasks',
} as const;
const GTDApiName = {
  createPlan: 'createPlan',
  createTodos: 'createTodos',
  clearTodos: 'clearTodos',
  updatePlan: 'updatePlan',
  updateTodos: 'updateTodos',
} as const;
const LocalSystemApiName = {
  editLocalFile: 'editLocalFile',
  globLocalFiles: 'globLocalFiles',
  grepContent: 'grepContent',
  listLocalFiles: 'listLocalFiles',
  moveLocalFiles: 'moveLocalFiles',
  readLocalFile: 'readLocalFile',
  renameLocalFile: 'renameLocalFile',
  runCommand: 'runCommand',
  searchLocalFiles: 'searchLocalFiles',
  writeLocalFile: 'writeLocalFile',
} as const;
const NotebookApiName = { createDocument: 'createDocument' } as const;
const MemoryApiName = { addExperienceMemory: 'addExperienceMemory' } as const;

const genericIntervention = GenericFallbackIntervention as unknown as React.ComponentType<
  MobileBuiltinInterventionProps<Record<string, unknown>>
>;

/** Registry: identifier -> apiName -> Intervention component */
const BUILTIN_INTERVENTIONS: Record<
  string,
  Record<string, React.ComponentType<MobileBuiltinInterventionProps<Record<string, unknown>>>>
> = {
  [AGENT_BUILDER_ID]: {
    [AgentBuilderApiName.installPlugin]: genericIntervention,
  },
  [CLOUD_SANDBOX_ID]: {
    [CloudSandboxApiName.executeCode]: CloudSandboxExecuteCode as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
  },
  [GROUP_MANAGEMENT_ID]: {
    [GroupManagementApiName.executeAgentTask]: genericIntervention,
    [GroupManagementApiName.executeAgentTasks]: genericIntervention,
  },
  [GTD_ID]: {
    [GTDApiName.createPlan]: GTDCreatePlan as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
    [GTDApiName.createTodos]: GTDAddTodo as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
    [GTDApiName.clearTodos]: GTDClearTodos as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
  },
  [LOCAL_SYSTEM_ID]: {
    [LocalSystemApiName.editLocalFile]: genericIntervention,
    [LocalSystemApiName.globLocalFiles]: genericIntervention,
    [LocalSystemApiName.grepContent]: genericIntervention,
    [LocalSystemApiName.listLocalFiles]: genericIntervention,
    [LocalSystemApiName.moveLocalFiles]: genericIntervention,
    [LocalSystemApiName.readLocalFile]: genericIntervention,
    [LocalSystemApiName.renameLocalFile]: genericIntervention,
    [LocalSystemApiName.runCommand]: genericIntervention,
    [LocalSystemApiName.searchLocalFiles]: genericIntervention,
    [LocalSystemApiName.writeLocalFile]: genericIntervention,
  },
  [MEMORY_ID]: {
    [MemoryApiName.addExperienceMemory]: MemoryAddExperience as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
  },
  [NOTEBOOK_ID]: {
    [NotebookApiName.createDocument]: NotebookCreateDocument as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
  },
};

export function getMobileBuiltinIntervention(
  identifier?: string,
  apiName?: string,
): React.ComponentType<MobileBuiltinInterventionProps<Record<string, unknown>>> | undefined {
  if (!identifier || !apiName) return undefined;
  const toolset = BUILTIN_INTERVENTIONS[identifier];
  return toolset?.[apiName];
}
