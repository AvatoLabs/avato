import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { type StateCreator } from 'zustand/vanilla';

import { createDevtools } from '../middleware/createDevtools';
import { flattenActions } from '../utils/flattenActions';
import { type SourceSetStoreState } from './initialState';
import { initialState } from './initialState';
import { type SourceSetContentAction } from './slices/content';
import { createContentSlice } from './slices/content';
import { type SourceSetCrudAction } from './slices/crud';
import { createCrudSlice } from './slices/crud';
import { type RAGEvalAction } from './slices/ragEval';
import { createRagEvalSlice } from './slices/ragEval';

//  ===============  Aggregate createStoreFn ============ //

export interface SourceSetStore
  extends SourceSetStoreState, SourceSetCrudAction, SourceSetContentAction, RAGEvalAction {
  // empty
}

type SourceSetStoreAction = SourceSetCrudAction & SourceSetContentAction & RAGEvalAction;

const createStore: StateCreator<SourceSetStore, [['zustand/devtools', never]]> = (
  ...parameters: Parameters<StateCreator<SourceSetStore, [['zustand/devtools', never]]>>
) => ({
  ...initialState,
  ...flattenActions<SourceSetStoreAction>([
    createCrudSlice(...parameters),
    createContentSlice(...parameters),
    createRagEvalSlice(...parameters),
  ]),
});

//  ===============  Implement useStore ============ //
const devtools = createDevtools('sourceSet');

export const useSourceSetStore = createWithEqualityFn<SourceSetStore>()(
  devtools(createStore),
  shallow,
);
