import type { BuiltinInspector } from '@lobechat/types';

import { DocApiName } from '../../types';
import { EditTitleInspector } from './EditTitle';
import { GetDocContentInspector } from './GetDocContent';
import { InitDocInspector } from './InitDoc';
import { ModifyNodesInspector } from './ModifyNodes';
import { ReplaceTextInspector } from './ReplaceText';

/**
 * Docs Agent inspector component registry
 *
 * Inspector components customize the title/header area
 * of tool calls in the conversation UI.
 */
export const DocsAgentInspectors: Record<string, BuiltinInspector> = {
  [DocApiName.editTitle]: EditTitleInspector as BuiltinInspector,
  [DocApiName.getDocContent]: GetDocContentInspector as BuiltinInspector,
  [DocApiName.initDoc]: InitDocInspector as BuiltinInspector,
  [DocApiName.modifyNodes]: ModifyNodesInspector as BuiltinInspector,
  [DocApiName.replaceText]: ReplaceTextInspector as BuiltinInspector,
};
