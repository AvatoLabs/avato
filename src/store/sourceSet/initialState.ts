import { type SourceSetState } from './slices/crud';
import { initialSourceSetState } from './slices/crud';
import { type RAGEvalState } from './slices/ragEval';
import { initialDatasetState } from './slices/ragEval';

export type SourceSetStoreState = SourceSetState & RAGEvalState;

export const initialState: SourceSetStoreState = {
  ...initialSourceSetState,
  ...initialDatasetState,
};
