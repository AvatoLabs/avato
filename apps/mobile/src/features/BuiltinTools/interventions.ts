/**
 * Mobile Builtin Tools — Intervention registry for pending tool edit forms.
 * When tool is pending and we have an Intervention, show it above approve/reject buttons.
 */

import type React from 'react';

import type { MobileBuiltinInterventionProps } from './types';

import CloudSandboxExecuteCode from './cloudSandbox/interventions/ExecuteCode';
import GTDAddTodo from './gtd/interventions/AddTodo';
import GTDCreatePlan from './gtd/interventions/CreatePlan';
import MemoryAddExperience from './memory/interventions/AddExperienceMemory';
import NotebookCreateDocument from './notebook/interventions/CreateDocument';

const GTD_ID = 'lobe-gtd';
const NOTEBOOK_ID = 'lobe-notebook';
const MEMORY_ID = 'lobe-user-memory';
const CLOUD_SANDBOX_ID = 'lobe-cloud-sandbox';

const GTDApiName = {
  createPlan: 'createPlan',
  createTodos: 'createTodos',
  clearTodos: 'clearTodos',
  updatePlan: 'updatePlan',
  updateTodos: 'updateTodos',
} as const;
const NotebookApiName = { createDocument: 'createDocument' } as const;
const MemoryApiName = { addExperienceMemory: 'addExperienceMemory' } as const;
const CloudSandboxApiName = { executeCode: 'executeCode' } as const;

/** Registry: identifier -> apiName -> Intervention component */
const BUILTIN_INTERVENTIONS: Record<
  string,
  Record<string, React.ComponentType<MobileBuiltinInterventionProps<Record<string, unknown>>>>
> = {
  [GTD_ID]: {
    [GTDApiName.createPlan]: GTDCreatePlan as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
    [GTDApiName.createTodos]: GTDAddTodo as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
  },
  [NOTEBOOK_ID]: {
    [NotebookApiName.createDocument]: NotebookCreateDocument as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
  },
  [MEMORY_ID]: {
    [MemoryApiName.addExperienceMemory]: MemoryAddExperience as unknown as React.ComponentType<
      MobileBuiltinInterventionProps<Record<string, unknown>>
    >,
  },
  [CLOUD_SANDBOX_ID]: {
    [CloudSandboxApiName.executeCode]: CloudSandboxExecuteCode as unknown as React.ComponentType<
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
