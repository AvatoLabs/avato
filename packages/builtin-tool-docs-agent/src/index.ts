// Re-export runtime types from @lobechat/editor-runtime
export { DocsAgentManifest } from './manifest';
export { systemPrompt } from './systemRole';
export {
  DocApiName,
  DocsAgentIdentifier,
  type EditTitleState,
  type GetDocContentState,
  type InitDocState,
  type ModifyNodesState,
  type ReplaceTextState,
} from './types';
export type {
  EditTitleArgs,
  GetDocContentArgs,
  InitDocumentArgs,
  ModifyInsertOperation,
  ModifyNodesArgs,
  ModifyOperation,
  ModifyOperationResult,
  ModifyRemoveOperation,
  ModifyUpdateOperation,
  ReplaceTextArgs,
} from '@lobechat/editor-runtime';
