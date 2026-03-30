import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { type StateCreator } from 'zustand/vanilla';

import { createDevtools } from '../middleware/createDevtools';
import { flattenActions } from '../utils/flattenActions';
import { type AgentStoreState } from './initialState';
import { initialState } from './initialState';
import { type AgentSliceAction } from './slices/agent';
import { createAgentSlice } from './slices/agent';
import { type BotSliceAction } from './slices/bot';
import { createBotSlice } from './slices/bot';
import { type BuiltinAgentSliceAction } from './slices/builtin';
import { createBuiltinAgentSlice } from './slices/builtin';
import { type CronSliceAction } from './slices/cron';
import { createCronSlice } from './slices/cron';
import { type PluginSliceAction } from './slices/plugin';
import { createPluginSlice } from './slices/plugin';
import { type SourceSliceAction } from './slices/sources';
import { createSourceSlice } from './slices/sources';

//  ===============  aggregate createStoreFn ============ //

export interface AgentStore
  extends
    AgentSliceAction,
    BotSliceAction,
    BuiltinAgentSliceAction,
    CronSliceAction,
    SourceSliceAction,
    PluginSliceAction,
    AgentStoreState {}

type AgentStoreAction = AgentSliceAction &
  BotSliceAction &
  BuiltinAgentSliceAction &
  CronSliceAction &
  SourceSliceAction &
  PluginSliceAction;

const createStore: StateCreator<AgentStore, [['zustand/devtools', never]]> = (
  ...parameters: Parameters<StateCreator<AgentStore, [['zustand/devtools', never]]>>
) => ({
  ...initialState,
  ...flattenActions<AgentStoreAction>([
    createAgentSlice(...parameters),
    createBotSlice(...parameters),
    createBuiltinAgentSlice(...parameters),
    createCronSlice(...parameters),
    createSourceSlice(...parameters),
    createPluginSlice(...parameters),
  ]),
});

//  ===============  implement useStore ============ //

const devtools = createDevtools('agent');

export const useAgentStore = createWithEqualityFn<AgentStore>()(devtools(createStore), shallow);

export const getAgentStoreState = () => useAgentStore.getState();
